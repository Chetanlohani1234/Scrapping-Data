const express = require('express');
const { chromium } = require('@playwright/test');
const fs = require('fs');
const https = require('https');
const path = require('path');

async function downloadImage(url, filePath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => reject(err.message));
        });
    });
}

async function scrapeProduct(url) {
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle' });

        // Selectors to extract information from the page
        const imgSelector = "img"; // Example selector for product image (might need adjustment)
        const textSelector = '.title-wrapper > h1'; // Example selector for product title (might need adjustment)
        const priceSelector = '.summary.entry-summary > p > span > bdi'; // Example selector for product price (might need adjustment)
        const detailsSelector = '.product-details-newblock'; // Example selector for product details (might need adjustment)
        const priceBreakupSelector = '#section-price-breakup table'; // Example selector for price breakup details (might need adjustment)

        // Wait for necessary elements to appear
        await page.waitForSelector(imgSelector);
        await page.waitForSelector(textSelector);
        await page.waitForSelector(priceSelector);
        await page.waitForSelector(detailsSelector);
        await page.waitForSelector(priceBreakupSelector);

        // Extract elements
        const textElement = await page.$(textSelector);
        const priceElement = await page.$(priceSelector);
        const detailsElement = await page.$(detailsSelector);
        const priceBreakupElement = await page.$(priceBreakupSelector);
        const imgElement = await page.$(imgSelector);

        if (!textElement || !priceElement || !detailsElement || !priceBreakupElement || !imgElement) {
            throw new Error('One or more selectors did not match any elements on the page.');
        }

        // Extract properties
        const text = await textElement.innerText();
        const price = await priceElement.innerText();
        const details = await detailsElement.innerText();
        const priceBreakupDetails = await priceBreakupElement.innerText();
        const imageUrl = await imgElement.getAttribute('src');

        // Remove newline characters
        const cleanText = text.replace(/\n/g, ' ');
        const cleanPrice = price.replace(/\n/g, ' ');
        const cleanDetails = details.replace(/\n/g, ' ');
        const cleanPriceBreakup = priceBreakupDetails.replace(/\n/g, ' ');

        let localImagePath = null;

        // Download the image and save it to a local path
        if (imageUrl) {
            const imageName = path.basename(imageUrl); // Extracts the image name from the URL
            const imagePath = path.join(__dirname, 'images', imageName); // Save it to the 'images' folder
            try {
                // Create the directory if it doesn't exist
                fs.mkdirSync(path.dirname(imagePath), { recursive: true });

                await downloadImage(imageUrl, imagePath);
                console.log(`Image downloaded and saved to ${imagePath}`);
                localImagePath = imagePath; // Set the local image path
            } catch (error) {
                console.error(`Failed to download image: ${error}`);
                throw new Error('Image download failed');
            }
        }

        await browser.close();

        return {
            srcTxt: cleanText,
            priceTxt: cleanPrice,
            productDetails: cleanDetails,
            priceBreakupTxt: cleanPriceBreakup,
            image: localImagePath
        };
    } catch (error) {
        if (browser) {
            await browser.close();
        }
        console.error(`Error in scrapeProduct: ${error.message}`);
        throw error;
    }
}

const app = express();
const port = process.env.PORT || 3000;

app.get('/scrape', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const data = await scrapeProduct(url);
        res.json(data);
    } catch (error) {
        console.error(`Error in /scrape endpoint: ${error.message}`);
        res.status(500).json({ error: 'An error occurred while scraping the product page' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
