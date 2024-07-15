// const puppeteer = require('puppeteer');

// async function scrapeProduct(url){
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();
//     await page.goto(url);

//     const [e1] = await page.$x('//*[@id="product-grid"]/li[4]/div/div/div[1]/div[1]/div/img[1]')
//     const src = await e1.getProperty('src');
//     const srcTxt = await src.jsonValue();

//     console.log({srcTxt});
// }

// scrapeProduct("https://www.giva.co/collections/all-sets?msclkid=a1883726008e13f721d851b6e7d0ba25&utm_source=bing&utm_medium=cpc&utm_campaign=Generic&utm_term=bluestone%20jewellery&utm_content=Jewellery")

/***Working */
// const puppeteer = require('puppeteer');

// async function scrapeProduct(url) {
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();
//     await page.goto(url, { waitUntil: 'networkidle2' }); // Wait until the page is fully loaded

//     // Use querySelector instead of XPath
//     //const imgSelector = "#product-377147 > div.rtwpvg-images.rtwpvg-images-thumbnail-columns-8.rtwpvg-has-product-thumbnail > div > div > div.rtwpvg-slider-wrapper > div > div > div > div.rtwpvg-gallery-image.rtwpvg-gallery-image-377142.slick-slide.slick-cloned > img"
//     const imgSelector = "#product-377147 img";
//     const textSelector = '#product-377147 > div.summary.entry-summary > div.title-wrapper > h1';
//     const priceSelector = '#product-377147 > div.summary.entry-summary > p > span > bdi'
//     const detailsSelector = '#section-item-details > div.product-details-newblock'
//     const priceBreakup = '#section-price-breakup > div > table';
//     const textElement = await page.$(textSelector);
//     const priceElement = await page.$(priceSelector);
//     const detailsElement = await page.$(detailsSelector);
//     const priceBreakupElement = await page.$(priceBreakup);
//     const imgElement = await page.$(imgSelector);


//     //const text = await page.evaluate(element => element.innerText.trim(), textElement);
//     const text = await textElement.getProperty('innerText');
//     const price = await priceElement.getProperty('innerText');
//     const details = await detailsElement.getProperty('innerText');
//     const priceBreakupDetails = await priceBreakupElement.getProperty('innerText');
//     //const img = await imgElement.getProperty('src')
//     const image = imgElement ? await (await imgElement.getProperty('src')).jsonValue() : null;
//     const priceTxt = await price.jsonValue();
//     const srcTxt = await text.jsonValue();
//     const productDetails = await details.jsonValue();
//     const priceBreakupTxt = await priceBreakupDetails.jsonValue();
//     //const image = await img.jsonValue();
 
//     console.log({ srcTxt,priceTxt,productDetails,priceBreakupTxt, image });

//     await browser.close();
// }

// scrapeProduct("https://jewelbox.co.in/hearts-all-the-way-diamond-bracelet/#divDiamond");

const express = require('express');
const puppeteer = require('puppeteer');
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
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: process.env.CHROMIUMclear_PATH || puppeteer.executablePath()
        });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Selectors
        const imgSelector = "#product-377147 img"; // Simplified selector
        const textSelector = '#product-377147 .title-wrapper > h1';
        const priceSelector = '#product-377147 .summary.entry-summary > p > span > bdi';
        const detailsSelector = '#section-item-details .product-details-newblock';
        const priceBreakupSelector = '#section-price-breakup table';

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
        const text = textElement ? await (await textElement.getProperty('innerText')).jsonValue() : null;
        const price = priceElement ? await (await priceElement.getProperty('innerText')).jsonValue() : null;
        const details = detailsElement ? await (await detailsElement.getProperty('innerText')).jsonValue() : null;
        const priceBreakupDetails = priceBreakupElement ? await (await priceBreakupElement.getProperty('innerText')).jsonValue() : null;
        const imageUrl = imgElement ? await (await imgElement.getProperty('src')).jsonValue() : null;

        // Remove newline characters
        const cleanText = text ? text.replace(/\n/g, ' ') : null;
        const cleanPrice = price ? price.replace(/\n/g, ' ') : null;
        const cleanDetails = details ? details.replace(/\n/g, ' ') : null;
        const cleanPriceBreakup = priceBreakupDetails ? priceBreakupDetails.replace(/\n/g, ' ') : null;

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
        res.status(500).json({ error: 'An error occurred while scraping the product' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});


// const puppeteer = require('puppeteer');

// async function scrapeProduct(url) {
//   try {
//     const browser = await puppeteer.launch({ headless: true }); // Launch Puppeteer in headless mode
//     const page = await browser.newPage();
//     await page.goto(url, { waitUntil: 'networkidle2' }); // Ensure the page is fully loaded

//     // Evaluate and fetch data for all products
//     const products = await page.evaluate(() => {
//       const items = document.querySelectorAll('#product-grid > li');

//       const data = [];

//       items.forEach(item => {
//         const img = item.querySelector('div > div > div.card__inner.color-background-2.gradient.ratio > div.card__media > div > img:nth-child(1)');
//         const price = item.querySelector('div > div > div.card__content > div.card__information > div > div > div > div.price__sale > span.price-item.price-item--sale.price-item--last');
//         //const description = item.querySelector('div > div > div.card__content > div.card__information > h3.card__heading h5 > a');
//         const description = item.querySelector('div > div > div.card__content > div.card__information > h3.card__heading > a');
       
//         // document.querySelector("#CardLink-template--16317651189922__product-grid-5410017673378")
//         data.push({
//           imgSrc: img ? img.src : null,
//           price: price ? price.innerText : null,
//           description: description ? description.innerText : null,
//         });
//       });

//       return data;
//     });

//     console.log(products);

//     await browser.close();
//   } catch (error) {
//     console.error('Error during scraping:', error);
//     process.exitCode = 1; // Set exit code to indicate failure
//   }
// }

// scrapeProduct("https://www.giva.co/collections/all-sets?msclkid=a1883726008e13f721d851b6e7d0ba25&utm_source=bing&utm_medium=cpc&utm_campaign=Generic&utm_term=bluestone%20jewellery&utm_content=Jewellery");