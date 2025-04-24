const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');

const WIDTH = 512;
const HEIGHT = 512;

async function convertLottieToGif(jsonUrl, outputPath) {
    const json = (await axios.get(jsonUrl)).data;

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.setViewport({ width: WIDTH, height: HEIGHT });
    await page.goto(`file://${path.resolve(__dirname, 'template.html')}`);

    // Модифицируем template на лету, добавляя необходимые функции
    await page.evaluate(() => {
        window.animationData = null;
        window.animationInstance = null;
        
        window.prepareAnimation = (data) => {
            return new Promise((resolve) => {
                window.animationData = data;
                const container = document.getElementById('lottie-container');
                container.innerHTML = ''; // Очищаем контейнер
                
                window.animationInstance = lottie.loadAnimation({
                    container: container,
                    renderer: 'canvas',
                    loop: false,
                    autoplay: false,
                    animationData: data
                });
                
                window.animationInstance.addEventListener('DOMLoaded', () => {
                    resolve();
                });
            });
        };
        
        window.getFrameCount = () => {
            return window.animationInstance ? window.animationInstance.totalFrames : 0;
        };
        
        window.goToFrame = (frame) => {
            if (window.animationInstance) {
                window.animationInstance.goToAndStop(frame, true);
            }
        };
        
        window.captureFrame = () => {
            const canvas = document.querySelector('#lottie-container canvas');
            return canvas ? canvas.toDataURL('image/png') : null;
        };
    });

    // Загружаем анимацию
    await page.evaluate(async (json) => {
        await window.prepareAnimation(json);
    }, json);

    // Получаем количество кадров
    const totalFrames = await page.evaluate(() => window.getFrameCount());
    if (totalFrames === 0) {
        throw new Error('Не удалось загрузить анимацию или определить количество кадров');
    }

    const encoder = new GIFEncoder(WIDTH, HEIGHT);
    encoder.createReadStream().pipe(fs.createWriteStream(outputPath));
    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(13); // ~80 FPS
    encoder.setQuality(10);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Захватываем каждый кадр
    for (let frame = 0; frame < totalFrames; frame++) {
        await page.evaluate((f) => window.goToFrame(f), frame);
        
        const frameData = await page.evaluate(() => window.captureFrame());
        if (!frameData) {
            console.warn(`Не удалось захватить кадр ${frame}`);
            continue;
        }

        const img = await loadImage(frameData);
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
        encoder.addFrame(ctx);
        
        // Прогресс
        if (frame % 10 === 0) {
            console.log(`Обработано ${frame + 1}/${totalFrames} кадров`);
        }
    }

    encoder.finish();
    await browser.close();
    console.log("✅ GIF успешно сохранён:", outputPath);
}

module.exports = { convertLottieToGif };