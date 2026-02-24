/**
 * Cookie管理器 - Popup脚本
 * 提供Cookie的显示、编辑、删除、导入导出功能
 */

class CookieManager {
  constructor() {
    this.currentTab = null;
    this.currentDomain = null;
    this.cookies = [];
    this.init();
  }

  /**
   * 初始化应用程序
   */
  async init() {
    await this.getCurrentTab();
    this.bindEvents();
    await this.loadCookies();
  }

  /**
   * 获取当前活动标签页信息
   */
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      this.currentDomain = new URL(tab.url).hostname;
      
      // 更新域名显示
      const domainInfo = document.getElementById('domainInfo');
      domainInfo.textContent = `当前域名: ${this.currentDomain}`;
    } catch (error) {
      console.error('获取当前标签页失败:', error);
      this.showError('无法获取当前页面信息');
    }
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 刷新按钮
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadCookies();
    });

    // 导入Cookie按钮
    document.getElementById('importBtn').addEventListener('click', () => {
      this.importCookies();
    });

    // 添加新Cookie按钮
    document.getElementById('addBtn').addEventListener('click', () => {
      this.addNewCookie();
    });

    // 清除所有Cookie按钮
    document.getElementById('clearAllBtn').addEventListener('click', () => {
      this.clearAllCookies();
    });

    // 导出Cookie按钮
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportCookies();
    });

    // Enter键快捷操作
    document.getElementById('newCookieName').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('newCookieValue').focus();
      }
    });

    document.getElementById('newCookieValue').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addNewCookie();
      }
    });
  }

  /**
   * 加载当前域名的所有Cookie
   */
  async loadCookies() {
    if (!this.currentDomain) {
      this.showError('无法确定当前域名');
      return;
    }

    try {
      const cookieList = document.getElementById('cookieList');
      cookieList.innerHTML = '<div class="loading">正在加载Cookie...</div>';

      // 获取当前域名的所有Cookie
      const cookies = await chrome.cookies.getAll({ domain: this.currentDomain });
      
      // 同时获取主域名和子域名的Cookie
      const mainDomain = this.getMainDomain(this.currentDomain);
      if (mainDomain !== this.currentDomain) {
        const mainDomainCookies = await chrome.cookies.getAll({ domain: mainDomain });
        cookies.push(...mainDomainCookies);
      }

      // 去重并排序
      this.cookies = this.removeDuplicateCookies(cookies);
      this.renderCookies();

    } catch (error) {
      console.error('加载Cookie失败:', error);
      this.showError('加载Cookie失败');
    }
  }

  /**
   * 获取主域名
   */
  getMainDomain(domain) {
    const parts = domain.split('.');
    if (parts.length >= 2) {
      return '.' + parts.slice(-2).join('.');
    }
    return domain;
  }

  /**
   * 去除重复的Cookie
   */
  removeDuplicateCookies(cookies) {
    const seen = new Set();
    return cookies.filter(cookie => {
      const key = `${cookie.name}-${cookie.domain}-${cookie.path}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 渲染Cookie列表
   */
  renderCookies() {
    const cookieList = document.getElementById('cookieList');
    
    if (this.cookies.length === 0) {
      cookieList.innerHTML = '<div class="empty-state">当前域名暂无Cookie</div>';
      return;
    }

    cookieList.innerHTML = this.cookies.map(cookie => `
      <div class="cookie-item" data-name="${this.escapeHtml(cookie.name)}" data-domain="${this.escapeHtml(cookie.domain)}" data-path="${this.escapeHtml(cookie.path)}" data-value="${this.escapeHtml(cookie.value)}">
        <div class="cookie-info">
          <div class="cookie-name">${this.escapeHtml(cookie.name)}</div>
          <div class="cookie-value" title="${this.escapeHtml(cookie.value)}">${this.escapeHtml(this.truncateValue(cookie.value))}</div>
        </div>
        <div class="edit-form">
          <input type="text" class="edit-name" value="${this.escapeHtml(cookie.name)}">
          <input type="text" class="edit-value" value="${this.escapeHtml(cookie.value)}">
        </div>
        <div class="cookie-actions">
          <button class="btn btn-info btn-small edit-btn">编辑</button>
          <button class="btn btn-success btn-small save-btn" style="display:none">保存</button>
          <button class="btn btn-secondary btn-small cancel-btn" style="display:none">取消</button>
          <button class="btn btn-info btn-small edit-copy-key">键</button>
          <button class="btn btn-info btn-small edit-copy-value">值</button>
          <button class="btn btn-success btn-small export-btn">导出</button>
          <button class="btn btn-danger btn-small delete-btn">删除</button>
        </div>
      </div>
    `).join('');

    // 绑定Cookie操作事件
    this.bindCookieEvents();
  }

  /**
   * 绑定Cookie项的事件
   */
  bindCookieEvents() {
    const cookieItems = document.querySelectorAll('.cookie-item');
    
    cookieItems.forEach(item => {
      const copyKeyBtn = item.querySelector('.edit-copy-key');
      const copyValueBtn = item.querySelector('.edit-copy-value');
      const editBtn = item.querySelector('.edit-btn');
      const saveBtn = item.querySelector('.save-btn');
      const exportBtn = item.querySelector('.export-btn');
      const cancelBtn = item.querySelector('.cancel-btn');
      const deleteBtn = item.querySelector('.delete-btn');

      copyKeyBtn.addEventListener('click', () => {
        this.copyCookie(item, true);
      });

      copyValueBtn.addEventListener('click', () => {
        this.copyCookie(item, false);
      });

      // 编辑按钮
      editBtn.addEventListener('click', () => {
        this.enterEditMode(item);
      });

      // 保存按钮
      saveBtn.addEventListener('click', () => {
        this.saveCookieEdit(item);
      });

      // 导出按钮
      exportBtn.addEventListener('click', () => {
        this.exportSelecttCookie(item);
      });
      // 取消按钮
      cancelBtn.addEventListener('click', () => {
        this.cancelEdit(item);
      });

      // 删除按钮
      deleteBtn.addEventListener('click', () => {
        this.deleteCookie(item);
      });
    });
  }
  /**
   * 导出选择Cookie
   */
  async copyCookie(item, isKey) {
    try {
      // 导出为JSON格式
      const cookieData = {};
      cookieData[item.dataset.name] = item.dataset.value;
      if (isKey) {
        await navigator.clipboard.writeText(item.dataset.name);
      } else {
        await navigator.clipboard.writeText(item.dataset.value);
      }
      this.showSuccess('已复制到剪贴板');

    } catch (error) {
      console.error('导出Cookie失败:', error);
      
      // fallback: 显示在输入框中
      const cookieData = {};
      this.cookies.forEach(cookie => {
        cookieData[cookie.name] = cookie.value;
      });
      
      document.getElementById('cookieInput').value = JSON.stringify(cookieData, null, 2);
      this.showSuccess('Cookie已显示在输入框中');
    }
  }
  /**
   * 进入编辑模式
   */
  enterEditMode(item) {
    item.classList.add('editing');
    item.querySelector('.edit-btn').style.display = 'none';
    item.querySelector('.edit-copy-key').style.display = 'none';
    item.querySelector('.edit-copy-value').style.display = 'none';
    item.querySelector('.export-btn').style.display = 'none';
    item.querySelector('.delete-btn').style.display = 'none';

    item.querySelector('.save-btn').style.display = 'inline-block';
    item.querySelector('.cancel-btn').style.display = 'inline-block';
    item.querySelector('.edit-name').focus();
  }
  /**
   * 导出选择Cookie
   */
  async exportSelecttCookie(item) {
    try {
      // 导出为JSON格式
      const cookieData = {};
      cookieData[item.dataset.name] = item.dataset.value;
      const jsonString = JSON.stringify(cookieData, null, 2);
      
      // 复制到剪贴板
      await navigator.clipboard.writeText(jsonString);
      this.showSuccess('Cookie已复制到剪贴板');

    } catch (error) {
      console.error('导出Cookie失败:', error);
      
      // fallback: 显示在输入框中
      const cookieData = {};
      this.cookies.forEach(cookie => {
        cookieData[cookie.name] = cookie.value;
      });
      
      document.getElementById('cookieInput').value = JSON.stringify(cookieData, null, 2);
      this.showSuccess('Cookie已显示在输入框中');
    }
  }
  /**
   * 保存Cookie编辑
   */
  async saveCookieEdit(item) {
    const name = item.dataset.name;
    const domain = item.dataset.domain;
    const path = item.dataset.path;
    const newName = item.querySelector('.edit-name').value.trim();
    const newValue = item.querySelector('.edit-value').value;

    if (!newName) {
      this.showError('Cookie名称不能为空');
      return;
    }

    try {
      // 如果名称改变了，先删除旧的Cookie
      if (name !== newName) {
        await chrome.cookies.remove({
          url: this.getUrlForCookie(domain, path),
          name: name
        });
      }

      // 设置新的Cookie
      await chrome.cookies.set({
        url: this.getUrlForCookie(domain, path),
        name: newName,
        value: newValue,
        domain: domain,
        path: path
      });

      this.cancelEdit(item);
      await this.loadCookies();
      this.showSuccess('Cookie已更新');

    } catch (error) {
      console.error('保存Cookie失败:', error);
      this.showError('保存Cookie失败');
    }
  }

  /**
   * 取消编辑
   */
  cancelEdit(item) {
    item.classList.remove('editing');
    item.querySelector('.edit-btn').style.display = 'inline-block';
    item.querySelector('.edit-copy-key').style.display = 'inline-block';
    item.querySelector('.edit-copy-value').style.display = 'inline-block';
    item.querySelector('.export-btn').style.display = 'inline-block';
    item.querySelector('.delete-btn').style.display = 'inline-block';
    item.querySelector('.save-btn').style.display = 'none';
    item.querySelector('.cancel-btn').style.display = 'none';
    
    // 恢复原始值
    const originalCookie = this.cookies.find(c => 
      c.name === item.dataset.name && 
      c.domain === item.dataset.domain && 
      c.path === item.dataset.path
    );
    
    if (originalCookie) {
      item.querySelector('.edit-name').value = originalCookie.name;
      item.querySelector('.edit-value').value = originalCookie.value;
    }
  }

  /**
   * 删除Cookie
   */
  async deleteCookie(item) {
    const name = item.dataset.name;
    const domain = item.dataset.domain;
    const path = item.dataset.path;

    if (!confirm(`确定要删除Cookie "${name}" 吗？`)) {
      return;
    }

    try {
      await chrome.cookies.remove({
        url: this.getUrlForCookie(domain, path),
        name: name
      });

      await this.loadCookies();
      this.showSuccess('Cookie已删除');

    } catch (error) {
      console.error('删除Cookie失败:', error);
      this.showError('删除Cookie失败');
    }
  }

  /**
   * 添加新Cookie
   */
  async addNewCookie() {
    const nameInput = document.getElementById('newCookieName');
    const valueInput = document.getElementById('newCookieValue');
    const name = nameInput.value.trim();
    const value = valueInput.value;

    if (!name) {
      this.showError('请输入Cookie名称');
      nameInput.focus();
      return;
    }

    try {
      await chrome.cookies.set({
        url: this.getUrlForCookie(this.currentDomain, '/'),
        name: name,
        value: value,
        domain: this.currentDomain,
        path: '/'
      });

      nameInput.value = '';
      valueInput.value = '';
      await this.loadCookies();
      this.showSuccess('Cookie已添加');

    } catch (error) {
      console.error('添加Cookie失败:', error);
      this.showError('添加Cookie失败');
    }
  }

  /**
   * 导入Cookie
   */
  async importCookies() {
    const input = document.getElementById('cookieInput').value.trim();
    
    if (!input) {
      this.showError('请输入要导入的Cookie数据');
      return;
    }

    try {
      const cookies = this.parseCookieInput(input);
      let successCount = 0;

      for (const [name, value] of Object.entries(cookies)) {
        try {
          await chrome.cookies.set({
            url: this.getUrlForCookie(this.currentDomain, '/'),
            name: name,
            value: value,
            domain: this.currentDomain,
            path: '/'
          });
          successCount++;
        } catch (error) {
          console.error(`设置Cookie ${name} 失败:`, error);
        }
      }

      document.getElementById('cookieInput').value = '';
      await this.loadCookies();
      this.showSuccess(`成功导入 ${successCount} 个Cookie`);

    } catch (error) {
      console.error('导入Cookie失败:', error);
      this.showError('导入Cookie失败: ' + error.message);
    }
  }

  /**
   * 解析Cookie输入
   */
  parseCookieInput(input) {
    // 尝试解析为JSON
    try {
      const parsed = JSON.parse(input);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      // 继续尝试其他格式
    }

    // 尝试解析为Cookie字符串格式
    const cookies = {};
    // 先进行url decode
    input = decodeURIComponent(input);
    const pairs = input.split(/[;&]/).map(pair => pair.trim()).filter(pair => pair);
    
    for (const pair of pairs) {
      const equalIndex = pair.indexOf('=');
      if (equalIndex > 0) {
        const name = pair.substring(0, equalIndex).trim();
        const value = pair.substring(equalIndex + 1).trim();
        cookies[name] = value;
      }
    }

    if (Object.keys(cookies).length === 0) {
      throw new Error('无法解析Cookie格式');
    }

    return cookies;
  }

  /**
   * 导出Cookie
   */
  async exportCookies() {
    if (this.cookies.length === 0) {
      this.showError('没有Cookie可以导出');
      return;
    }

    try {
      // 导出为JSON格式
      const cookieData = {};
      this.cookies.forEach(cookie => {
        cookieData[cookie.name] = cookie.value;
      });

      const jsonString = JSON.stringify(cookieData, null, 2);
      
      // 复制到剪贴板
      await navigator.clipboard.writeText(jsonString);
      this.showSuccess('Cookie已复制到剪贴板');

    } catch (error) {
      console.error('导出Cookie失败:', error);
      
      // fallback: 显示在输入框中
      const cookieData = {};
      this.cookies.forEach(cookie => {
        cookieData[cookie.name] = cookie.value;
      });
      
      document.getElementById('cookieInput').value = JSON.stringify(cookieData, null, 2);
      this.showSuccess('Cookie已显示在输入框中');
    }
  }

  /**
   * 清除所有Cookie
   */
  async clearAllCookies() {
    if (this.cookies.length === 0) {
      this.showError('没有Cookie可以清除');
      return;
    }

    if (!confirm(`确定要清除当前域名 (${this.currentDomain}) 的所有 ${this.cookies.length} 个Cookie吗？`)) {
      return;
    }

    try {
      let deletedCount = 0;
      
      for (const cookie of this.cookies) {
        try {
          await chrome.cookies.remove({
            url: this.getUrlForCookie(cookie.domain, cookie.path),
            name: cookie.name
          });
          deletedCount++;
        } catch (error) {
          console.error(`删除Cookie ${cookie.name} 失败:`, error);
        }
      }

      await this.loadCookies();
      this.showSuccess(`已清除 ${deletedCount} 个Cookie`);

    } catch (error) {
      console.error('清除Cookie失败:', error);
      this.showError('清除Cookie失败');
    }
  }

  /**
   * 获取Cookie对应的URL
   */
  getUrlForCookie(domain, path) {
    const protocol = 'https://';
    const cleanDomain = domain.startsWith('.') ? domain.substring(1) : domain;
    return protocol + cleanDomain + (path || '/');
  }

  /**
   * 截断长文本
   */
  truncateValue(value, maxLength = 50) {
    if (value.length <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength) + '...';
  }

  /**
   * HTML转义
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 显示成功消息
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  /**
   * 显示错误消息
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * 显示消息
   */
  showMessage(message, type) {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 15px;
      border-radius: 6px;
      color: white;
      font-size: 12px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
      background: ${type === 'success' ? '#28a745' : '#dc3545'};
    `;

    document.body.appendChild(messageEl);

    // 显示动画
    setTimeout(() => {
      messageEl.style.opacity = '1';
    }, 100);

    // 自动移除
    setTimeout(() => {
      messageEl.style.opacity = '0';
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 300);
    }, 3000);
  }
}

// 当DOM加载完成时初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new CookieManager();
});