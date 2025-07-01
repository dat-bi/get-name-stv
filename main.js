document.getElementById('pasteBtn').addEventListener('click', async function () {
    const urlInput = document.getElementById('urlInput');
    const clipboardUrl = await getUrlFromClipboard();
    if (clipboardUrl) {
        urlInput.value = clipboardUrl;
        showStatus('✅ Đã dán URL từ clipboard!', 'success');
    } else {
        showStatus('❌ Không thể lấy URL từ clipboard!', 'error');
    }
});

function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    if (type === 'loading') {
        statusDiv.innerHTML = `<div class="loading-spinner"></div>${message}`;
    } else {
        statusDiv.innerHTML = message;
    }
}

function hideStatus() {
    const statusDiv = document.getElementById('status');
    statusDiv.style.display = 'none';
}

function parseNamesFromJson(jsonData) {
    const names = [];
    
    // Xử lý dữ liệu từ API response
    if (jsonData && jsonData.result && jsonData.result.div) {
        jsonData.result.div.forEach((content, index) => {
            const title = `Gói ${index + 1}`;
            names.push({
                title: title,
                content: content,
                index: index
            });
        });
    }
    
    return names;
}

function createNameItem(nameData) {
    const lines = nameData.content.split(/\n|\$/).filter(line => line.trim());
    const displayContent = lines.slice(0, 8).join('\n');
    const hasMore = lines.length > 8;
    const nameCount = lines.length;

    return `
        <div class="name-item">
            <div class="name-header">
                <div class="name-title">${nameData.title}</div>
                <div class="name-meta">
                    📊  ${nameCount} names 
                </div>
            </div>
            <div class="name-content">${displayContent}${hasMore ? '\n... và nhiều hơn nữa' : ''}</div>
            <div class="name-actions">
                <button class="btn btn-small" onclick="downloadNameFile('${nameData.title}', ${nameData.index})">
                    📥 Tải xuống TXT
                </button>
            </div>
        </div>
    `;
}

let currentNamesData = [];

function downloadNameFile(title, index) {
    const nameData = currentNamesData[index];
    if (!nameData) return;

    let content = nameData.content;

    // Xử lý content: loại bỏ $ ở đầu và thay thế các ký tự đặc biệt
    if (content.startsWith("$")) {
        content = content.substring(1);
    }
    content = content.replace(/\n\$/g, '\n').replace(/\$/g, '\n');

    // Tạo và tải file
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s/g, '_')}_names.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus(`Đã tải xuống "${title}"`, 'success');
}

async function fetchNamesData(url) {
    if (url.slice(-1) === "/") url = url.slice(0, -1);

    const urlParts = url.split('/truyen/');
    if (urlParts.length !== 2) {
        throw new Error("URL không đúng định dạng!");
    }

    let host = urlParts[0];
    host = host.replace(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/img, 'http://sangtacviet.app')
    const params = urlParts[1].split('/');
    const bookhost = params[0];
    const bookid = params[2];

    if (!bookhost || !bookid) {
        throw new Error("Không thể lấy thông tin host hoặc book ID!");
    }

    // Tạo API URL
    const apiUrl = `${host}/namesys.php?host=${bookhost}&book=${bookid}`;
    const proxyUrl = `https://web.scraper.workers.dev/?url=${encodeURIComponent(apiUrl)}&selector=div&scrape=text&pretty=true`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        if (!data || !data.result || !data.result.div || data.result.div.length === 0) {
            throw new Error("Truyện không có name được chia sẻ!");
        }
        
        // Xử lý dữ liệu trước khi parse
        const processedData = {
            result: {
                div: data.result.div.map(item => {
                    // Xử lý từng item trong mảng div
                    let processedItem = item;
                    if (processedItem.startsWith("$")) {
                        processedItem = processedItem.substring(1);
                    }
                    processedItem = processedItem.replace(/\n\$/g, '\n');
                    return processedItem;
                })
            }
        };
        
        return parseNamesFromJson(processedData);
        
    } catch (error) {
        console.error('Fetch error:', error);
        throw new Error(`Lỗi khi tải dữ liệu: ${error.message}`);
    }
}

async function getUrlFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const trimmedText = text.trim();

        console.log('Clipboard content:', trimmedText);

        // Kiểm tra xem có phải URL hợp lệ không
        if (trimmedText && (trimmedText.includes('sangtacviet') || trimmedText.includes('14.225.254.182')) && trimmedText.includes('/truyen/')) {
            return trimmedText;
        }

        return null;
    } catch (error) {
        console.log('Lỗi khi đọc clipboard:', error);
        return null;
    }
}

document.getElementById('searchForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const urlInput = document.getElementById('urlInput');
    const searchBtn = document.getElementById('searchBtn');
    const namesList = document.getElementById('namesList');
    const namesContainer = document.getElementById('namesContainer');
    let url = urlInput.value.trim();

    let regexSTV = "/\/truyen\/.*?\/1\/.*?\//gmi"
    let regexWiki = "/wikidich.*?\/truyen\/.*?/"
    if (!url.includes('/truyen/')) {
        showStatus('URL không đúng định dạng!', 'error');
        return;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = 'Đang tìm...';
    showStatus('Đang tìm kiếm names...', 'loading');
    namesList.style.display = 'none';

    try {
        const names = await fetchNamesData(url);
        currentNamesData = names;

        if (names.length === 0) {
            showStatus('Không tìm thấy names nào!', 'error');
            return;
        }

        namesContainer.innerHTML = names.map(createNameItem).join('');
        namesList.style.display = 'block';

        // Tính tổng số names
        const totalNames = names.reduce((total, nameData) => {
            const lines = nameData.content.split(/\n|\$/).filter(line => line.trim());
            return total + lines.length;
        }, 0);

        showStatus(`Tìm thấy ${names.length} gói names với tổng cộng ${totalNames} names!`, 'success');

    } catch (error) {
        console.error('Error:', error);
        showStatus(`Lỗi: ${error.message}`, 'error');
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Tìm Names';
    }
});

document.getElementById('urlInput').addEventListener('input', function () {
    hideStatus();
});