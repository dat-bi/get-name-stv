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

function parseNamesFromHTML(htmlText) {
    const names = [];

    // Tìm các div chứa names bằng regex
    const divRegex = /<div[^>]*white-space:nowrap[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    let index = 0;

    while ((match = divRegex.exec(htmlText)) !== null) {
        const content = match[1].trim();
        if (content && content.includes('$')) {
            // Tìm title từ text trước div
            const beforeDiv = htmlText.substring(0, match.index);
            const titleMatch = beforeDiv.match(/(\w+)\s*$/);
            const title = titleMatch ? titleMatch[1] : `Gói ${index + 1}`;

            // Tìm word count và timestamp sau div
            const afterDiv = htmlText.substring(match.index + match[0].length);
            const numberMatch = afterDiv.match(/^\s*(\d+)/);
            const dateMatch = afterDiv.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);

            names.push({
                title: title,
                content: content,
                wordCount: numberMatch ? numberMatch[1] : 'N/A',
                timestamp: dateMatch ? dateMatch[1] : 'N/A',
                index: index
            });
            index++;
        }
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
                    👤 ${nameCount} names | 📊 ${nameData.wordCount} từ | 🕒 ${nameData.timestamp}
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
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_names.txt`;
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

    const host = urlParts[0];
    const params = urlParts[1].split('/');
    const bookhost = params[0];
    const bookid = params[2];

    if (!bookhost || !bookid) {
        throw new Error("Không thể lấy thông tin host hoặc book ID!");
    }

    // Tạo API URL
    const apiUrl = `${host.replace('sangtacviet.com', 'sangtacviet.app')}/namesys.php?host=${bookhost}&book=${bookid}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`Lỗi kết nối: ${response.status}`);
    }

    const data = await response.json();
    const htmlContent = data.contents || '';

    if (!htmlContent) {
        throw new Error("Không nhận được dữ liệu từ server!");
    }

    return parseNamesFromHTML(htmlContent);
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

    // Nếu không có URL trong input, thử lấy từ clipboard
    if (!url) {
        searchBtn.addEventListener('click', async function () {
            const urlInput = document.getElementById('urlInput');
            const clipboardUrl = await getUrlFromClipboard();
            if (clipboardUrl) {
                urlInput.value = clipboardUrl;
                showStatus('✅ Đã dán URL từ clipboard!', 'success');
            } else {
                showStatus('❌ Không thể lấy URL từ clipboard!', 'error');
            }
        });
    }

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
