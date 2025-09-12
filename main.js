// 音频上下文和分析器
let audioContext;
let analyser;
let microphone;
let isListening = false;

// 抽奖相关参数
const prizes = ['一等奖', '二等奖', '三等奖', '谢谢参与'];
let isSpinning = false;
let currentRotation = 0;

// DOM元素
const wheel = document.getElementById('wheel');
const volumeBar = document.getElementById('volumeBar');
const startBtn = document.getElementById('startBtn');

// 初始化抽奖转盘
function initWheel() {
    const segmentAngle = 360 / prizes.length;
    prizes.forEach((prize, index) => {
        const segment = document.createElement('div');
        segment.style.position = 'absolute';
        segment.style.width = '50%';
        segment.style.height = '2px';
        segment.style.left = '50%';
        segment.style.top = '50%';
        segment.style.transformOrigin = 'left';
        segment.style.transform = `rotate(${index * segmentAngle}deg)`;
        
        const text = document.createElement('div');
        text.style.position = 'absolute';
        text.style.left = '60px';
        text.style.transform = 'rotate(90deg)';
        text.style.transformOrigin = 'left';
        text.textContent = prize;
        
        segment.appendChild(text);
        wheel.appendChild(segment);
    });
}

// 初始化音频
async function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        isListening = true;
        startVolumeDetection();
    } catch (error) {
        console.error('无法访问麦克风:', error);
        alert('请允许访问麦克风以使用声控功能');
    }
}

// 音量检测
function startVolumeDetection() {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    function detectVolume() {
        if (!isListening) return;
        
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
        const normalizedVolume = Math.min(100, (volume / 128) * 100);
        
        volumeBar.style.width = `${normalizedVolume}%`;
        
        if (normalizedVolume > 80 && !isSpinning) {
            startSpin();
        }
        
        requestAnimationFrame(detectVolume);
    }
    
    detectVolume();
}

// 开始抽奖
function startSpin() {
    if (isSpinning) return;
    isSpinning = true;
    
    const extraSpins = 5; // 额外旋转圈数
    const segmentAngle = 360 / prizes.length;
    const targetPrizeIndex = Math.floor(Math.random() * prizes.length);
    const targetAngle = targetPrizeIndex * segmentAngle;
    
    const totalRotation = currentRotation + (360 * extraSpins) + targetAngle;
    wheel.style.transform = `rotate(${totalRotation}deg)`;
    
    setTimeout(() => {
        isSpinning = false;
        currentRotation = totalRotation % 360;
        alert(`恭喜获得：${prizes[targetPrizeIndex]}！`);
    }, 3000);
}

// 事件监听
startBtn.addEventListener('click', () => {
    if (!audioContext) {
        initAudio();
    }
});

// 初始化
initWheel();