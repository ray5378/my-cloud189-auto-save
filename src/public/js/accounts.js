let accountsList = []
let chooseAccount = null
let familyFolderSelectorOpen = false

// 账号相关功能
async function fetchAccounts(updateSelect = false) {
    const response = await fetch('/api/accounts');
    const data = await response.json();
    // 如果http状态码为401, 则跳转到登录页面
    if (response.status === 401) {
        window.location.href = '/login';
        return;
    }

    if (data.success) {
        accountsList = data.data

        // 按家庭组分组展示
        const familyGroups = {}
        accountsList.forEach(account => {
            const fid = account.familyId || 'no_family'
            if (!familyGroups[fid]) {
                familyGroups[fid] = { familyId: fid, accounts: [] }
            }
            familyGroups[fid].accounts.push(account)
        })

        const tbody = document.querySelector('#accountTable tbody');
        tbody.innerHTML = '';

        Object.keys(familyGroups).forEach(fid => {
            const group = familyGroups[fid]
            const isSameFamily = fid !== 'no_family' && group.accounts.length > 1

            // 家庭组标题行（优化样式）
            tbody.innerHTML += `
                <tr class="family-group-header" style="background: linear-gradient(90deg, var(--card-bg) 0%, var(--hover-bg, #f0f0f0) 100%); border-left: 3px solid var(--primary-color);">
                    <td colspan="8" style="padding: 10px 16px; font-weight: 600; color: var(--text-primary);">
                        <span class="family-toggle-icon" onclick="toggleFamilyGroup('${fid}')" style="cursor: pointer; margin-right: 8px; transition: transform 0.2s;">▼</span>
                        <span style="font-size: 14px;">家庭组 ${fid === 'no_family' ? '(无家庭空间)' : fid.slice(-6)}</span>
                        <span style="font-size: 12px; color: #888; margin-left: 8px;">(${group.accounts.length}个账号)</span>
                        ${isSameFamily ? '<span style="color: #22c55e; font-size: 11px; margin-left: 12px; padding: 2px 8px; background: rgba(34, 197, 94, 0.15); border-radius: 4px;">💡 同家庭组共用空间</span>' : ''}
                    </td>
                </tr>
            `;

            // 账号行
            group.accounts.forEach(account => {
                // 显示家庭中转目录状态：已配置显示ID，继承显示来源，自动创建显示提示
                let familyFolderDisplay = '';
                if (account.familyFolderId) {
                    familyFolderDisplay = `已配置 (${account.familyFolderId.slice(-6)})`;
                } else if (isSameFamily) {
                    // 查找同家庭组中已配置的账号
                    const sourceAccount = group.accounts.find(a => a.familyFolderId && a.id !== account.id);
                    familyFolderDisplay = sourceAccount ? `继承自 ${sourceAccount.username}` : '继承';
                } else {
                    familyFolderDisplay = '自动创建';
                }
                tbody.innerHTML += `
                    <tr class="family-group-row" data-family="${fid}">
                        <td><span class="default-star" onclick="setDefaultAccount(${account.id})" title="设为默认账号">
                                ${account.isDefault ? '★' : '☆'}
                            </span>
                             <button class="btn-primary" onclick="editAccount(${account.id})">修改</button>
                            <button class="btn-danger" onclick="deleteAccount(${account.id})">删除</button>
                            </td>
                        <td data-label='账户名'>${account.username}</td>
                        <td data-label='别名' onclick="updateAlias(${account.id}, '${account.alias || ''}')">${account.alias || '-'}</td>
                        <td data-label='个人容量'>${formatBytes(account.capacity.cloudCapacityInfo.usedSize) + '/' + formatBytes(account.capacity.cloudCapacityInfo.totalSize)}</td>
                        <td data-label='家庭容量'>${formatBytes(account.capacity.familyCapacityInfo.usedSize) + '/' + formatBytes(account.capacity.familyCapacityInfo.totalSize)}</td>
                        <td data-label='家庭中转目录' style="cursor: pointer; color: ${account.familyFolderId ? '#22c55e' : '#888'};" onclick="updateFamilyFolder(${account.id}, '${account.familyFolderId || ''}', '${account.familyId || ''}')">${familyFolderDisplay}</td>
                        <td class='strm-prefix' data-label='媒体目录' style="cursor: pointer;" onclick="updateCloudStrmPrefix(${account.id}, '${account.cloudStrmPrefix || ''}')">${account.cloudStrmPrefix || '-'}</td>
                        <td class='strm-prefix' data-label='本地目录' style="cursor: pointer;" onclick="updateLocalStrmPrefix(${account.id}, '${account.localStrmPrefix || ''}')">${account.localStrmPrefix || '-'}</td>
                    </tr>
                `;
            })
        })

        // 更新任务创建页面的账号下拉
        if (updateSelect) {
            const select = document.querySelector('#accountId');
            select.innerHTML = ''
            accountsList.forEach(account => {
                if (!account.username.startsWith('n_')) {
                    select.innerHTML += `
                    <option value="${account.id}" ${account.isDefault?"selected":''}>${account.username}</option>
                `;
                }
            })
        }
    }
}

// 切换家庭组展开/折叠（带图标旋转动画）
function toggleFamilyGroup(fid) {
    const rows = document.querySelectorAll(`.family-group-row[data-family="${fid}"]`)
    const headerRow = rows[0]?.previousElementSibling
    const icon = headerRow?.querySelector('.family-toggle-icon')
    const isCollapsed = rows[0]?.style.display === 'none'

    rows.forEach(row => {
        row.style.display = isCollapsed ? '' : 'none'
    })

    // 旋转图标
    if (icon) {
        icon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)'
    }
}

async function deleteAccount(id) {
    if (!confirm('确定要删除这个账号吗？')) return;
    loading.show()
    const response = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE'
    });
    loading.hide()
    const data = await response.json();
    if (data.success) {
        message.success('账号删除成功');
        fetchAccounts();
    } else {
        message.warning('账号删除失败: ' + data.error);
    }
}

// 添加账号表单处理
function initAccountForm() {
    document.getElementById('accountForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createAccount();
    });
}

function openAddAccountModal() {
    chooseAccount = null
    const modal = document.getElementById('addAccountModal');
    modal.style.display = 'block';
}

function closeAddAccountModal() {
    const modal = document.getElementById('addAccountModal');
    modal.style.display = 'none';
    const modalTitle = modal.querySelector('h3');
    modalTitle.textContent = '添加账号';
    const submitBtn = modal.querySelector('button[type="submit"]');
    submitBtn.textContent = '添加';
    document.getElementById('username').removeAttribute('readonly')
    // 清空表单
    document.getElementById('accountForm').reset();
    // 移除可能存在的验证码容器
    const captchaContainer = document.querySelector('.captcha-container');
    if (captchaContainer) {
        captchaContainer.remove();
    }
    chooseAccount = null
}

async function editAccount(id) {
    // 获取账号信息
    chooseAccount = accountsList.find(acc => acc.id === id);
    if (!chooseAccount) {
        message.warning('账号不存在');
        return;
    }

    // 打开模态框
    const modal = document.getElementById('addAccountModal');
    modal.style.display = 'block';

    // 修改标题
    const modalTitle = modal.querySelector('h3');
    modalTitle.textContent = '修改账号';

    // 填充表单数据
    document.getElementById('username').value = chooseAccount.username;
    document.getElementById('password').value = chooseAccount.password; // 出于安全考虑，不填充密码
    document.getElementById('cookie').value = chooseAccount.cookies || '';
    document.getElementById('alias').value = chooseAccount.alias || '';
    document.getElementById('cloudStrmPrefix').value = chooseAccount.cloudStrmPrefix || '';
    document.getElementById('localStrmPrefix').value = chooseAccount.localStrmPrefix || '';
    document.getElementById('embyPathReplace').value = chooseAccount.embyPathReplace || '';
    // 账号不允许修改
    document.getElementById('username').setAttribute('readonly', true )
    // 修改提交按钮文本
    const submitBtn = modal.querySelector('button[type="submit"]');
    submitBtn.textContent = '修改';
}

async function createAccount() {
    let username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const cookies  = document.getElementById('cookie').value;
    const alias = document.getElementById('alias').value;
    const validateCodeDom = document.getElementById('validateCode')
    const cloudStrmPrefix = document.getElementById('cloudStrmPrefix').value;
    const localStrmPrefix = document.getElementById('localStrmPrefix').value;
    const embyPathReplace = document.getElementById('embyPathReplace').value;
    let validateCode = "";
    if (validateCodeDom) {
        validateCode = validateCodeDom.value;
    }
    if (!username ) {
        message.warning('用户名不能为空');
        return;
    }
    if (!password && !cookies) {
        message.warning('密码和Cookie不能同时为空');
        return;
    }
    if (chooseAccount?.id) {
        username = chooseAccount.original_username
    }
    loading.show()
    const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: chooseAccount?.id, username, password, cookies, alias, validateCode, cloudStrmPrefix, localStrmPrefix, embyPathReplace })
    });
    const data = await response.json();
    if (data.success) {
        loading.hide()
        message.success('成功');
        document.getElementById('accountForm').reset();
        if (validateCodeDom) {
            // 移除验证码容器
            document.getElementById('account-captcha').style.display = 'none';
            validateCodeDom.value = ''
        }
        closeAddAccountModal();
        fetchAccounts();
    } else {
        loading.hide()
        // 如果返回的code是NEED_CAPTCHA, 则展示二维码和输入框, 允许用户输入验证码后重新提交
        if (data.code === 'NEED_CAPTCHA') {
            // 展示二维码
            document.getElementById('account-captcha').style.display = 'block';
            document.getElementById('captchaImage').src = data.data.captchaUrl;
            message.warning('请输入验证码后重新提交');
        }else{
            message.warning('账号添加失败: ' + data.error);
        }
    }
}
function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return '0B';
    if (bytes < 0) return '-' + formatBytes(-bytes);
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const base = 1024;
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
    const value = bytes / Math.pow(base, exponent);
    
    return value.toFixed(exponent > 0 ? 2 : 0) + units[exponent];
}
async function clearRecycleBin() {
    if (!confirm('确定要清空所有账号的回收站吗？')) {
        return;
    }
    try {
        const response = await fetch('/api/accounts/recycle', {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
            message.success('后台任务执行中, 请稍后查看结果');
        } else {
            message.warning('清空回收站失败: ' + data.error);
        }
    } catch (error) {
        message.warning('操作失败: ' + error.message);
    }
}

// 添加更新 STRM 前缀的函数
async function updateCloudStrmPrefix(id, currentPrefix) {
    const newPrefix = prompt('请输入新的媒体目录前缀', currentPrefix);
    if (newPrefix === null) return; // 用户点击取消
    try {
        const response = await fetch(`/api/accounts/${id}/strm-prefix`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strmPrefix: newPrefix, type: 'cloud'  })
        });

        const data = await response.json();
        if (data.success) {
            message.success('更新成功');
            fetchAccounts(true);
        } else {
            message.warning('更新失败: ' + data.error);
        }
    } catch (error) {
        message.warning('操作失败: ' + error.message);
    }
}
async function updateLocalStrmPrefix(id, currentPrefix) {
    const newPrefix = prompt('请输入新的本地目录前缀', currentPrefix);
    if (newPrefix === null) return; // 用户点击取消

    try {
        const response = await fetch(`/api/accounts/${id}/strm-prefix`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strmPrefix: newPrefix, type: 'local' })
        });

        const data = await response.json();
        if (data.success) {
            message.success('更新成功');
            fetchAccounts(true);
        } else {
            message.warning('更新失败: ' + data.error);
        }
    } catch (error) {
        message.warning('操作失败: ' + error.message);
    }
}

async function updateEmbyPathReplace(id, embyPathReplace) {
    const newEmbyPathReplace = prompt('请输入新的Emby替换路径', embyPathReplace);
    if (newEmbyPathReplace === null) return; // 用户点击取消

    try {
        const response = await fetch(`/api/accounts/${id}/strm-prefix`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strmPrefix: newEmbyPathReplace, type: 'emby' })
        });

        const data = await response.json();
        if (data.success) {
            message.success('更新成功');
            fetchAccounts(true);
        } else {
            message.warning('更新失败: ' + data.error);
        }
    } catch (error) {
        message.warning('操作失败: ' + error.message);
    }
}

async function updateAlias(id, currentAlias) {
    const newAlias = prompt('请输入新的别名', currentAlias);
    if (newAlias === null) return; 
    try {
        const response = await fetch(`/api/accounts/${id}/alias`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alias: newAlias })
        })
        const data = await response.json();
        if (data.success) {
            message.success('更新成功');
            fetchAccounts(true);
        } else {
            message.warning('更新失败:'+ data.error);
        }
    } catch (error) {
        message.warning('操作失败:'+ error.message);
    }
}

async function setDefaultAccount(id) {
    try {
        const response = await fetch(`/api/accounts/${id}/default`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
            message.success('设置默认账号成功');
            fetchAccounts(true);  // 更新账号列表和下拉框
        } else {
            message.warning('设置默认账号失败: ' + data.error);
        }
    } catch (error) {
        message.warning('操作失败: ' + error.message);
    }
}

// 更新家庭中转目录（弹出目录选择器）
async function updateFamilyFolder(accountId, currentFolderId, familyId) {
    if (!familyId) {
        message.warning('该账号无家庭空间，无法配置家庭中转目录');
        return;
    }

    // 创建目录选择器弹窗
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'familyFolderModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>选择家庭中转目录</h3>
            </div>
            <div style="padding: 20px;">
                <p style="color: #888; font-size: 13px; margin-bottom: 15px;">
                    💡 选择家庭空间中的目录作为中转目录，留空则自动创建临时目录
                </p>
                <div id="folderTreeContainer" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; max-height: 300px; overflow-y: auto;">
                    <div style="text-align: center; padding: 20px; color: #888;">加载中...</div>
                </div>
                <div style="margin-top: 15px;">
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="autoCreateFolder" ${!currentFolderId ? 'checked' : ''}>
                        <span style="font-size: 13px;">自动创建临时目录（每次任务完成后删除）</span>
                    </label>
                </div>
            </div>
            <div class="form-actions" style="padding: 15px 20px; border-top: 1px solid var(--border-color);">
                <button type="button" class="btn-secondary" onclick="closeFamilyFolderModal()">取消</button>
                <button type="button" class="btn-primary" onclick="confirmFamilyFolder(${accountId})">确认</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';

    // 加载家庭目录树
    await loadFamilyFolderTree(accountId, '', currentFolderId);
}

// 加载家庭目录树
async function loadFamilyFolderTree(accountId, folderId, selectedFolderId) {
    const container = document.getElementById('folderTreeContainer');
    if (!container) return;

    try {
        const response = await fetch(`/api/accounts/${accountId}/family/folders?folderId=${folderId}`);
        const data = await response.json();

        if (!data.success) {
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: #e74c3c;">加载失败: ${data.error}</div>`;
            return;
        }

        const folders = data.data.folders || [];
        if (folders.length === 0 && folderId === '') {
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">家庭空间无目录，将自动创建</div>`;
            return;
        }

        // 构建目录树
        let html = folderId === '' ? `
            <div class="folder-item" data-folder-id="" style="padding: 8px; cursor: pointer; border-radius: 4px; ${selectedFolderId === '' ? 'background: var(--primary-color); color: white;' : ''}" onclick="selectFamilyFolder('', '家庭根目录')">
                📁 家庭根目录（自动创建临时目录）
            </div>
        ` : '';

        folders.forEach(folder => {
            const isSelected = folder.id === selectedFolderId;
            html += `
                <div class="folder-item" data-folder-id="${folder.id}" style="padding: 8px; cursor: pointer; border-radius: 4px; margin-left: ${folderId ? '15px' : '0'}; ${isSelected ? 'background: var(--primary-color); color: white;' : ''}" onclick="selectFamilyFolder('${folder.id}', '${folder.name}')">
                    📁 ${folder.name}
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<div style="text-align: center; padding: 20px; color: #e74c3c;">加载失败: ${error.message}</div>`;
    }
}

// 选择目录
function selectFamilyFolder(folderId, folderName) {
    // 更新选中状态
    document.querySelectorAll('.folder-item').forEach(item => {
        item.style.background = '';
        item.style.color = '';
    });
    const selected = document.querySelector(`.folder-item[data-folder-id="${folderId}"]`);
    if (selected) {
        selected.style.background = 'var(--primary-color)';
        selected.style.color = 'white';
    }

    // 更新checkbox状态
    const checkbox = document.getElementById('autoCreateFolder');
    if (checkbox) {
        checkbox.checked = !folderId;
    }

    // 保存选中值
    window.selectedFamilyFolderId = folderId;
    window.selectedFamilyFolderName = folderName;
}

// 关闭弹窗
function closeFamilyFolderModal() {
    const modal = document.getElementById('familyFolderModal');
    if (modal) {
        modal.remove();
    }
    window.selectedFamilyFolderId = undefined;
    window.selectedFamilyFolderName = undefined;
}

// 确认选择
async function confirmFamilyFolder(accountId) {
    const checkbox = document.getElementById('autoCreateFolder');
    const folderId = checkbox?.checked ? '' : (window.selectedFamilyFolderId || '');

    try {
        loading.show();
        const response = await fetch(`/api/accounts/${accountId}/family-folder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ familyFolderId: folderId })
        });
        loading.hide();

        const data = await response.json();
        if (data.success) {
            message.success('家庭中转目录配置成功');
            closeFamilyFolderModal();
            fetchAccounts(true);
        } else {
            message.warning('配置失败: ' + data.error);
        }
    } catch (error) {
        loading.hide();
        message.warning('操作失败: ' + error.message);
    }
}