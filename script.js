const { createApp, ref } = Vue;

const app = createApp({
    setup() {
        const startNumber = ref(1); // 默认从1开始
        const endNumber = ref(10);
        const currentNumber = ref(1);
        const isRunning = ref(false);
        const isPaused = ref(false);
        const isCancelled = ref(false);
        const isAscending = ref(true);
        const outputMessage = ref('请输入起始和结束数字，然后点击“开始”');
        const nextNumber = ref(0);

        // 分贝检测相关
        const decibelThreshold = ref(50);
        const currentDecibel = ref(0.00);
        const isDecibelDetectionRunning = ref(false);
        let audioContext = null;
        let analyser = null;
        let microphone = null;
        let scriptProcessor = null;
        let isDecibelTriggered = false;

        // 初始化音频上下文
        function initAudioContext() {
            try {
                if (!audioContext) {
                    if (!window.AudioContext && !window.webkitAudioContext) {
                        console.warn('浏览器不支持 AudioContext API');
                        outputMessage.value = '当前浏览器不支持音频处理，请尝试使用其他浏览器。';
                        isDecibelDetectionRunning.value = false;
                        return;
                    }
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    analyser = audioContext.createAnalyser();
                    analyser.fftSize = 512;
                }
            } catch (error) {
                console.error('初始化 AudioContext 失败:', error);
                outputMessage.value = '初始化音频上下文失败，请检查浏览器设置。';
                isDecibelDetectionRunning.value = false;
            }
        }

        function startDecibelDetection() {
            if (isDecibelDetectionRunning.value) return;

            // 初始化音频上下文（延迟到用户交互时初始化）
            initAudioContext();

            // 检查浏览器是否支持 getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('浏览器不支持 getUserMedia API');
                outputMessage.value = '当前浏览器不支持麦克风访问，请尝试使用其他浏览器或检查浏览器设置。';
                isDecibelDetectionRunning.value = false;
                return;
            }

            // 获取麦克风输入
            navigator.mediaDevices.getUserMedia({ audio: true })
              .then((stream) => {
                    microphone = audioContext.createMediaStreamSource(stream);
                    scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

                    microphone.connect(analyser);
                    analyser.connect(scriptProcessor);
                    scriptProcessor.connect(audioContext.destination);

                    scriptProcessor.onaudioprocess = () => {
                        const dataArray = new Uint8Array(analyser.frequencyBinCount);
                        analyser.getByteFrequencyData(dataArray);

                        // 计算平均分贝值
                        const sum = dataArray.reduce((acc, val) => acc + val, 0);
                        const average = sum / dataArray.length;
                        currentDecibel.value = parseFloat(average.toFixed(2));

                        // 如果分贝值超过阈值且未触发过报数
                        if (currentDecibel.value > decibelThreshold.value && !isDecibelTriggered) {
                            isDecibelTriggered = true;
                            speakSingleNumber();
                        }
                    };

                    isDecibelDetectionRunning.value = true;
                    outputMessage.value = '分贝检测已开启';
                })
              .catch((err) => {
                    console.error('无法获取麦克风权限:', err);
                    outputMessage.value = '无法获取麦克风权限，请检查浏览器设置或使用其他浏览器。';
                    isDecibelDetectionRunning.value = false;
                });

            console.log('尝试开启分贝检测');
        }

        // 停止分贝检测
        function stopDecibelDetection() {
            if (!isDecibelDetectionRunning.value) return;

            if (scriptProcessor) {
                scriptProcessor.disconnect();
                scriptProcessor.onaudioprocess = null;
            }
            if (microphone) {
                microphone.disconnect();
            }
            if (audioContext) {
                audioContext.close();
                audioContext = null;
            }

            isDecibelDetectionRunning.value = false;
            isDecibelTriggered = false;
            resetCounting();
            outputMessage.value = '分贝检测已关闭';
        }

        // 重置报数状态
        function resetCounting() {
            currentNumber.value = isAscending.value ? startNumber.value : endNumber.value;
            outputMessage.value = `当前数字：${currentNumber.value}`;
        }

        // 分贝触发时只报一个数
        function speakSingleNumber() {
            if (isCancelled.value || isPaused.value) return;

            const utterance = new SpeechSynthesisUtterance(currentNumber.value.toString());
            utterance.lang = 'zh-CN';
            utterance.onend = () => {
                if (!isCancelled.value && !isPaused.value) {
                    // 自动递增逻辑
                    if (isAscending.value) {
                        currentNumber.value++;
                        if (currentNumber.value > endNumber.value) {
                            currentNumber.value = startNumber.value;
                        }
                    } else {
                        currentNumber.value--;
                        if (currentNumber.value < startNumber.value) {
                            currentNumber.value = endNumber.value;
                        }
                    }
                    outputMessage.value = `当前数字：${currentNumber.value}`;
                }
                // 重置触发标志位
                isDecibelTriggered = false;
            };
            window.speechSynthesis.speak(utterance);
        }

        // 报数逻辑
        function startCounting() {
            if (isRunning.value) return;

            const start = parseInt(startNumber.value, 10);
            const end = parseInt(endNumber.value, 10);

            if (isNaN(start) || isNaN(end) || start >= end) {
                outputMessage.value = '请输入有效的起始和结束数字！';
                return;
            }

            isRunning.value = true;
            isPaused.value = false;
            isCancelled.value = false;
            currentNumber.value = isAscending.value ? start : end;
            nextNumber.value = currentNumber.value;
            outputMessage.value = `当前数字：${currentNumber.value}`;

            speakNumber(currentNumber.value);
        }

        function pauseCounting() {
            if (isRunning.value && !isPaused.value) {
                isPaused.value = true;
                outputMessage.value = `已暂停，当前数字：${currentNumber.value}`;
                window.speechSynthesis.cancel();
            }
        }

        function resumeCounting() {
            if (isRunning.value && isPaused.value) {
                isPaused.value = false;
                if (isAscending.value) {
                    nextNumber.value = currentNumber.value + 1;
                } else {
                    nextNumber.value = currentNumber.value - 1;
                }
                currentNumber.value = nextNumber.value;
                outputMessage.value = `当前数字：${currentNumber.value}`;
                speakNumber(currentNumber.value);
            }
        }

        function cancelCounting() {
            isRunning.value = false;
            isPaused.value = false;
            isCancelled.value = true;
            window.speechSynthesis.cancel();
            outputMessage.value = '任务已取消';
        }

        function toggleOrder() {
            isAscending.value = !isAscending.value;
            outputMessage.value = `当前顺序：${isAscending.value ? '正序' : '倒序'}`;
        }

        function speakNumber(number) {
            if (isCancelled.value || isPaused.value) return;

            const utterance = new SpeechSynthesisUtterance(number.toString());
            utterance.lang = 'zh-CN';
            utterance.onend = () => {
                if (!isCancelled.value && !isPaused.value) {
                    if (isAscending.value) {
                        currentNumber.value++;
                        if (currentNumber.value <= endNumber.value) {
                            outputMessage.value = `当前数字：${currentNumber.value}`;
                            speakNumber(currentNumber.value);
                        } else {
                            outputMessage.value = '报数完成！';
                            isRunning.value = false;
                        }
                    } else {
                        currentNumber.value--;
                        if (currentNumber.value >= startNumber.value) {
                            outputMessage.value = `当前数字：${currentNumber.value}`;
                            speakNumber(currentNumber.value);
                        } else {
                            outputMessage.value = '报数完成！';
                            isRunning.value = false;
                        }
                    }
                }
            };
            window.speechSynthesis.speak(utterance);
        }

        function startFromOne() {
            startNumber.value = 1;
            endNumber.value = 10; // 默认数到10
            currentNumber.value = 1;
            outputMessage.value = '已重置，将从1开始数';
            if (isDecibelDetectionRunning.value) {
                isDecibelTriggered = false;
            }
        }

        return {
            startNumber,
            endNumber,
            isRunning,
            isPaused,
            isAscending,
            outputMessage,
            decibelThreshold,
            currentDecibel,
            isDecibelDetectionRunning,
            startCounting,
            pauseCounting,
            resumeCounting,
            cancelCounting,
            toggleOrder,
            startDecibelDetection,
            stopDecibelDetection,
            startFromOne
        };
    }
});

app.mount('#app');


function calculateDecibel(rms) {
    // 将RMS值转换为分贝值
    // 参考值设置为1e-5（接近人耳能听到的最小声音）
    return 20 * Math.log10(rms / 1e-5);
}

function calculateRMS(data) {
    // 计算均方根值
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
}

// 添加新的状态变量
const lastDecibel = ref(0);
const debounceTimer = ref(null);
const soundHistory = ref([]); // 用于存储最近的声音数据

// 修改音频处理回调函数
scriptProcessor.onaudioprocess = (event) => {
    const inputBuffer = event.inputBuffer;
    const inputData = inputBuffer.getChannelData(0);
    
    // 计算RMS值
    const rms = calculateRMS(inputData);
    
    // 转换为分贝值
    const decibelValue = calculateDecibel(rms);
    
    // 计算声音变化率
    const decibelChange = decibelValue - lastDecibel.value;
    lastDecibel.value = decibelValue;
    
    // 频域分析
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);
    
    // 分析低频和高频成分
    const lowFreq = frequencyData.slice(0, frequencyData.length / 4).reduce((a, b) => a + b, 0);
    const highFreq = frequencyData.slice(frequencyData.length / 4).reduce((a, b) => a + b, 0);
    const freqRatio = highFreq / (lowFreq + 1); // 防止除零
    
    // 拍打声检测条件
    const isSharpChange = decibelChange > 10; // 声音突变
    const isHighFreq = freqRatio > 1.5; // 高频成分较多
    const isShortDuration = soundHistory.value.length < 5; // 持续时间短
    
    // 更新声音历史记录
    soundHistory.value.push(decibelValue);
    if (soundHistory.value.length > 10) {
        soundHistory.value.shift();
    }
    
    // 防抖处理
    if (debounceTimer.value) {
        clearTimeout(debounceTimer.value);
    }
    
    // 检测拍打声
    if (isSharpChange && isHighFreq && isShortDuration && !isDecibelTriggered) {
        debounceTimer.value = setTimeout(() => {
            isDecibelTriggered = true;
            speakSingleNumber();
            debounceTimer.value = null;
        }, 100); // 100ms防抖
    }
    
    // 更新当前分贝值
    currentDecibel.value = Math.max(0, decibelValue.toFixed(2));
};


// 获取背景元素
const hackerBg = document.getElementById('hacker-bg');

// 定义字符集
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:\",./<>?';

// 生成随机字符
function getRandomChar() {
    return chars.charAt(Math.floor(Math.random() * chars.length));
}

// 生成动态字符
function createHackerChar() {
    const char = document.createElement('span');
    char.classList.add('hacker-char');
    char.textContent = getRandomChar();
    char.style.left = `${Math.random() * 100}vw`;
    char.style.animationDuration = `${Math.random() * 5 + 5}s`; // 动画时长随机
    hackerBg.appendChild(char);

    // 一段时间后移除字符
    setTimeout(() => {
        char.remove();
    }, 10000);
}

// 定时生成字符
setInterval(createHackerChar, 100);