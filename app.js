// app.js
let videoQueue = [];
let currentVideoData = null;
let isPlaying = false;
let currentDownloadId = null;

// DOM Elements
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const queueStatus = document.getElementById('queueStatus');

const emptyState = document.getElementById('emptyState');
const playerState = document.getElementById('playerState');
const loadingOverlay = document.getElementById('loadingOverlay');

const tweetAvatar = document.getElementById('tweetAvatar');
const tweetAuthor = document.getElementById('tweetAuthor');
const tweetText = document.getElementById('tweetText');
const mainVideo = document.getElementById('mainVideo');
const qualitySelect = document.getElementById('qualitySelect');
const btnSkip = document.getElementById('btnSkip');
const btnDownload = document.getElementById('btnDownload');

// Regex for extracting X / Twitter links
const twitterLinkRegex = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/g;

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  // Add user message to chat
  addChatMessage(text, 'user');
  chatInput.value = '';

  // Extract links
  const matches = [...text.matchAll(twitterLinkRegex)];
  if (matches.length > 0) {
    let addedCount = 0;
    matches.forEach(match => {
      const url = match[0];
      const username = match[1];
      const id = match[2];
      
      // Prevent duplicates in queue
      if (!videoQueue.some(v => v.id === id)) {
        videoQueue.push({ url, username, id });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      addChatMessage(`${addedCount} adet video linki kuyruğa eklendi.`, 'bot');
      updateQueueStatus();
      
      if (!isPlaying) {
        processNextVideo();
      }
    } else {
      addChatMessage(`Bu linkler zaten kuyrukta mevcut.`, 'bot');
    }
  } else {
    addChatMessage(`Geçerli bir Twitter/X linki bulamadım. Lütfen linkleri kontrol et.`, 'bot');
  }
});

function addChatMessage(text, sender) {
  const div = document.createElement('div');
  div.className = 'flex gap-3 chat-bubble ' + (sender === 'user' ? 'flex-row-reverse' : '');
  
  const avatar = document.createElement('div');
  avatar.className = `w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-white ${sender === 'user' ? 'bg-green-500' : 'bg-blue-500'}`;
  avatar.textContent = sender === 'user' ? 'S' : 'B';

  const msgBox = document.createElement('div');
  msgBox.className = `p-3 rounded-lg max-w-[85%] text-sm ${sender === 'user' ? 'bg-blue-600 rounded-tr-none text-white' : 'bg-gray-700 rounded-tl-none text-gray-100'}`;
  msgBox.textContent = text;

  div.appendChild(avatar);
  div.appendChild(msgBox);
  
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateQueueStatus() {
  queueStatus.textContent = `Kuyruk: ${videoQueue.length} Video`;
}

async function processNextVideo() {
  if (videoQueue.length === 0) {
    isPlaying = false;
    currentVideoData = null;
    emptyState.classList.remove('hidden');
    playerState.classList.add('hidden');
    return;
  }

  isPlaying = true;
  emptyState.classList.add('hidden');
  playerState.classList.remove('hidden');
  playerState.style.display = 'flex';
  loadingOverlay.classList.remove('hidden');
  
  const nextVideo = videoQueue[0];
  
  try {
    // Fetch video details via api.vxtwitter.com
    const apiUrl = `https://api.vxtwitter.com/${nextVideo.username}/status/${nextVideo.id}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) throw new Error('API yanıt vermedi veya rate limit aşıldı.');
    
    const data = await response.json();
    
    // Check if there is a video
    let media = null;
    if (data.media_extended && data.media_extended.length > 0) {
      media = data.media_extended.find(m => m.type === 'video');
    }

    if (!media) {
      throw new Error('Bu tweette video bulunamadı.');
    }

    currentVideoData = {
      id: data.tweetID,
      author: data.user_name,
      screen_name: data.user_screen_name,
      text: data.text,
      avatar: data.user_profile_image_url,
      videoUrl: media.url,
      thumbnail: media.thumbnail_url,
      size: media.size,
      variants: media.variants || null
    };

    renderPlayer(currentVideoData);

  } catch (error) {
    console.error(error);
    addChatMessage(`Hata: ${nextVideo.url} işlenirken sorun oluştu (${error.message}). Atlanıyor...`, 'bot');
    // Skip and move to next
    videoQueue.shift();
    updateQueueStatus();
    processNextVideo();
  } finally {
    loadingOverlay.classList.add('hidden');
  }
}

function renderPlayer(data) {
  tweetAvatar.src = data.avatar || '';
  tweetAuthor.textContent = `${data.author} (@${data.screen_name})`;
  tweetText.textContent = data.text;
  
  mainVideo.src = data.videoUrl;
  mainVideo.poster = data.thumbnail || '';
  
  qualitySelect.innerHTML = '';
  
  if (data.variants && Array.isArray(data.variants) && data.variants.length > 0) {
    // If API provides multiple variants (e.g. 720p, 480p)
    data.variants.forEach(variant => {
      const option = document.createElement('option');
      option.value = variant.url;
      option.textContent = `${variant.resolution || 'Bilinmeyen Kalite'} (MP4)`;
      qualitySelect.appendChild(option);
    });
  } else {
    // Fallback to the main video URL
    const resText = data.size ? `${data.size.width}x${data.size.height}` : 'En İyi Kalite';
    const option = document.createElement('option');
    option.value = data.videoUrl;
    option.textContent = resText + ' (MP4)';
    qualitySelect.appendChild(option);
  }
  
  mainVideo.play().catch(e => console.log('Otomatik oynatma engellendi', e));
}

btnSkip.addEventListener('click', () => {
  if (videoQueue.length > 0) {
    videoQueue.shift();
    updateQueueStatus();
    processNextVideo();
  }
});

btnDownload.addEventListener('click', () => {
  if (!currentVideoData) return;
  
  const selectedUrl = qualitySelect.value;
  const safeUsername = currentVideoData.screen_name.replace(/[^a-zA-Z0-9]/g, '');
  const filename = `Twitter_${safeUsername}_${currentVideoData.id}.mp4`;

  // Use background script to download to bypass CORS / handle downloads gracefully
  chrome.runtime.sendMessage({
    action: "downloadVideo",
    url: selectedUrl,
    filename: filename
  }, (response) => {
    if (response && response.success) {
      currentDownloadId = response.downloadId;
      btnDownload.textContent = 'İniyor...';
      btnDownload.disabled = true;
      btnDownload.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      alert('İndirme başlatılamadı: ' + (response ? response.error : 'Bilinmeyen hata'));
    }
  });
});

// Listen for download completion to auto-advance
if (typeof chrome !== 'undefined' && chrome.downloads) {
  chrome.downloads.onChanged.addListener((delta) => {
    if (delta.id === currentDownloadId) {
      if (delta.state && delta.state.current === 'complete') {
        // Download complete, move to next video
        currentDownloadId = null;
        
        // Reset button
        btnDownload.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg> İndir`;
        btnDownload.disabled = false;
        btnDownload.classList.remove('opacity-50', 'cursor-not-allowed');

        if (videoQueue.length > 0) {
          videoQueue.shift();
          updateQueueStatus();
          processNextVideo();
        }
      } else if (delta.state && delta.state.current === 'interrupted') {
        alert('İndirme kesintiye uğradı.');
        btnDownload.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg> İndir (Hata)`;
        btnDownload.disabled = false;
        btnDownload.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
  });
}
