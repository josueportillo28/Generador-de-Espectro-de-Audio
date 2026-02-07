document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('audioFile');
    const audioPlayer = document.getElementById('audioPlayer');
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('colorPicker');
    const styleSelect = document.getElementById('visualStyle');
    const btnRecord = document.getElementById('btnRecord');
    const recIndicator = document.getElementById('recordingIndicator');
    const canvasContainer = document.getElementById('canvasContainer');

    let audioContext, analyser, source, dataArray, bufferLength;
    let isInitialized = false;
    let mediaRecorder, recordedChunks = [], isRecording = false, dest;

    function resizeCanvas() {
        canvas.width = canvasContainer.clientWidth;
        canvas.height = canvasContainer.clientHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            audioPlayer.src = URL.createObjectURL(file);
            if (!isInitialized) initAudioContext();
        }
    });

    function initAudioContext() {
        isInitialized = true;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; 
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        source = audioContext.createMediaElementSource(audioPlayer);
        dest = audioContext.createMediaStreamDestination();
        
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.connect(dest);
        
        animate();
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (analyser) {
            analyser.getByteFrequencyData(dataArray);
            const style = styleSelect.value;
            const color = colorPicker.value;

            switch(style) {
                case 'bar': drawBars(color); break;
                case 'mirror': drawMirror(color); break;
                case 'pulse': drawPulse(color); break;
                case 'line': drawLine(color); break;
                case 'circle': drawCircle(color); break;
                case 'dots': drawDots(color); break;
                case 'blocks': drawBlocks(color); break;
            }
        }
        requestAnimationFrame(animate);
    }

    // DISEÑOS CON MEJOR DEFINICIÓN (GAPS)
    function drawBars(color) {
        const gap = 6; // Espacio mayor para definición en Chroma
        const barWidth = (canvas.width / bufferLength) - gap;
        for(let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            ctx.fillStyle = color;
            ctx.fillRect(i * (barWidth + gap), canvas.height - barHeight, barWidth, barHeight);
        }
    }

    function drawMirror(color) {
        const gap = 3;
        const barWidth = (canvas.width / 2 / bufferLength) - gap;
        const centerX = canvas.width / 2;
        for(let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * (canvas.height * 0.7);
            ctx.fillStyle = color;
            ctx.fillRect(centerX + (i * (barWidth + gap)), (canvas.height - barHeight)/2, barWidth, barHeight);
            ctx.fillRect(centerX - (i * (barWidth + gap)) - barWidth, (canvas.height - barHeight)/2, barWidth, barHeight);
        }
    }

    function drawPulse(color) {
        const barWidth = 10;
        const gap = 5;
        const totalBars = Math.floor(canvas.width / (barWidth + gap));
        for(let i = 0; i < totalBars; i++) {
            const val = dataArray[i % bufferLength];
            const h = (val / 255) * (canvas.height * 0.6);
            ctx.fillStyle = color;
            ctx.fillRect(i * (barWidth + gap), (canvas.height / 2) - (h / 2), barWidth, h);
        }
    }

    function drawLine(color) {
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = color;
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;
        for(let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvas.height) / 2;
            if(i === 0) ctx.moveTo(x, canvas.height - y);
            else ctx.lineTo(x, canvas.height - y);
            x += sliceWidth;
        }
        ctx.stroke();
    }

    function drawCircle(color) {
        const centerX = canvas.width / 2, centerY = canvas.height / 2;
        const radius = 80;
        ctx.lineWidth = 5;
        for(let i = 0; i < 60; i++) {
            const angle = (i * 2 * Math.PI) / 60;
            const barLen = (dataArray[i] / 255) * 120;
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(centerX + Math.cos(angle)*radius, centerY + Math.sin(angle)*radius);
            ctx.lineTo(centerX + Math.cos(angle)*(radius+barLen), centerY + Math.sin(angle)*(radius+barLen));
            ctx.stroke();
        }
    }

    function drawDots(color) {
        const slice = canvas.width / 30;
        for(let i = 0; i < 30; i++) {
            const h = (dataArray[i*3] / 255) * canvas.height;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(i * slice + slice/2, canvas.height - h - 15, 6, 0, Math.PI*2);
            ctx.fill();
        }
    }

    function drawBlocks(color) {
        const bW = 25, bH = 12, gap = 6;
        const cols = Math.floor(canvas.width / (bW + gap));
        for(let i = 0; i < cols; i++) {
            const level = Math.floor((dataArray[i] / 255) * 12);
            for(let j = 0; j < level; j++) {
                ctx.fillStyle = color;
                ctx.fillRect(i*(bW+gap), canvas.height - (j*(bH+gap)) - bH, bW, bH);
            }
        }
    }

    // GRABACIÓN DE ALTA CALIDAD
    btnRecord.onclick = () => {
        if (!isInitialized) return alert("Carga un audio primero");
        
        if (!isRecording) {
            const stream = canvas.captureStream(60); // Subimos a 60 FPS para suavidad
            const combined = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
            
            // CONFIGURACIÓN DE BITRATE Y CÓDEC VP9
            const options = { 
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 8000000, // 8 Mbps para nitidez extrema
                audioBitsPerSecond: 128000
            };

            try {
                mediaRecorder = new MediaRecorder(combined, options);
            } catch (e) {
                console.error("VP9 no soportado, usando defecto", e);
                mediaRecorder = new MediaRecorder(combined, { videoBitsPerSecond: 8000000 });
            }

            recordedChunks = [];
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'Espectro_VP9_VaritaPixel.webm';
                a.click();
            };

            mediaRecorder.start();
            isRecording = true;
            btnRecord.textContent = "⏹ Detener y Guardar";
            btnRecord.style.backgroundColor = "#ffcc00";
            btnRecord.style.color = "#000";
            recIndicator.classList.remove('hidden');
        } else {
            mediaRecorder.stop();
            isRecording = false;
            btnRecord.textContent = "🎥 Grabar Espectro";
            btnRecord.style.backgroundColor = "#cc2900";
            btnRecord.style.color = "#fff";
            recIndicator.classList.add('hidden');
        }
    };
});

window.changeBg = (color) => {
    document.getElementById('canvasContainer').style.background = color;
};