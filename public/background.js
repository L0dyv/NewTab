
// Background script for Chrome extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('NewTab extension installed');
});

// Handle tab creation
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url === 'chrome://newtab/') {
    // The extension will automatically override the new tab page
  }
});

// 监听来自前端的消息，用于获取网页标题
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_PAGE_TITLE') {
    const url = request.url;
    console.log('[Background] 收到获取标题请求:', url);

    fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
      }
    })
      .then(response => {
        console.log('[Background] Fetch 响应状态:', response.status);
        return response.text();
      })
      .then(html => {
        console.log('[Background] 获取到 HTML 长度:', html.length);

        // 解析 HTML 获取 title
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        let title = titleMatch ? titleMatch[1].trim() : null;

        console.log('[Background] 匹配到的 title:', title);

        // 如果没有 title，尝试获取 og:title
        if (!title) {
          const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
          if (ogTitleMatch) {
            title = ogTitleMatch[1].trim();
            console.log('[Background] 使用 og:title:', title);
          }
        }

        if (title) {
          console.log('[Background] 返回标题:', title);
          sendResponse({ success: true, title });
        } else {
          // 使用域名作为备用
          try {
            const urlObj = new URL(url);
            const fallback = urlObj.hostname.replace('www.', '');
            console.log('[Background] 使用域名备用:', fallback);
            sendResponse({ success: true, title: fallback });
          } catch {
            sendResponse({ success: false, error: '无法解析URL' });
          }
        }
      })
      .catch(error => {
        console.error('[Background] Fetch 错误:', error);
        // 获取失败时使用域名作为备用
        try {
          const urlObj = new URL(url);
          sendResponse({ success: true, title: urlObj.hostname.replace('www.', '') });
        } catch {
          sendResponse({ success: false, error: error.message });
        }
      });

    // 返回 true 表示异步响应
    return true;
  }
});
