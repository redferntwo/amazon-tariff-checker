/**
 * Amazon Tariff Checker
 * Copyright (c) 2025 Dual Lens (https://duallens.substack.com)
 * This code is licensed under the MIT License.
 * For the full license text, see the LICENSE file in the project repository
 * or visit: https://opensource.org/licenses/MIT
 * DISCLAIMER: This extension is not affiliated with Amazon.com. It only processes
 * information visible on the current page and does not collect or transmit user data.
 * All analysis occurs locally within the browser.
 */


// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Message received in content script:', request);
  if (request.action === 'checkTariff') {
    try {
      console.log('Starting tariff check');
      const productData = extractProductData();
      console.log('Product data extracted:', productData);
      
      if (productData.error) {
        console.error('Error in product data:', productData.error);
        sendResponse({ error: productData.error });
        return true;
      }
      
      // Use simpler direct approach for now to ensure modal appears
      const tariffData = fallbackCalculation(productData);
      console.log('Tariff calculated:', tariffData);
      
      // Show the modal directly
      showTariffModal(productData, tariffData);
      sendResponse({ success: true, ...tariffData });
      
      return true; // Indicate we'll respond asynchronously
    } catch (error) {
      console.error('Unexpected error in content script:', error);
      sendResponse({ error: 'Unexpected error: ' + error.message });
      return true;
    }
  }
});

// Extract product data from the Amazon page
function extractProductData() {
  console.log('Starting product data extraction');
  try {
    // Basic product info
    const productTitleElement = document.getElementById('productTitle');
    console.log('Product title element found:', !!productTitleElement);
    
    const productTitle = productTitleElement ? productTitleElement.textContent.trim() : 'Unknown Product';
    console.log('Product title:', productTitle);
    
    // Extract price
    console.log('Attempting to extract price');
    let price = 0;
    
    // Try multiple price selector patterns
    const priceSelectors = [
      '.a-price .a-offscreen', 
      '.a-color-price', 
      '.a-price',
      '#price_inside_buybox',
      '#priceblock_ourprice',
      '.price-large'
    ];
    
    let priceElement = null;
    for (const selector of priceSelectors) {
      console.log('Trying price selector:', selector);
      const element = document.querySelector(selector);
      if (element) {
        priceElement = element;
        console.log('Found price element with selector:', selector);
        break;
      }
    }
    
    if (priceElement) {
      const priceText = priceElement.textContent.trim();
      console.log('Raw price text:', priceText);
      // Remove currency symbols and commas, then parse as float
      price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
      console.log('Parsed price:', price);
    } else {
      console.log('No price element found');
    }
    
    // Extract country of origin using simplified approach
    console.log('Attempting to extract country of origin');
    const countryOfOrigin = extractCountryOfOrigin();
    console.log('Country of origin:', countryOfOrigin);
    
    // Get product category
    const category = extractCategory();
    console.log('Product category:', category);
    
    // Return the data
    return {
      productTitle,
      price: isNaN(price) ? 0 : price,
      countryOfOrigin: countryOfOrigin || 'Unknown',
      category
    };
  } catch (error) {
    console.error('Error extracting product data:', error);
    return { error: 'Error processing product information: ' + error.message };
  }
}

// Extract product category
function extractCategory() {
  try {
    // Try to find breadcrumbs
    const breadcrumbs = document.querySelector('#wayfinding-breadcrumbs_container');
    if (breadcrumbs) {
      const links = breadcrumbs.querySelectorAll('a');
      if (links.length > 0) {
        // Return the last breadcrumb as the most specific category
        return links[links.length - 1].textContent.trim();
      }
    }
    
    // Try alternate category indicators
    const categoryElements = document.querySelectorAll('.a-link-normal.a-color-tertiary');
    for (const element of categoryElements) {
      if (element.textContent.includes('in') || element.textContent.includes('category')) {
        return element.textContent.trim();
      }
    }
    
    return '';
  } catch (error) {
    console.error('Error extracting category:', error);
    return '';
  }
}

// Extract country of origin from various locations on the page
function extractCountryOfOrigin() {
  try {
    console.log('Looking for country of origin in various places');
    
    // Method 1: Look in product details table
    const detailsTable = document.querySelector('#productDetails_detailBullets_sections1');
    if (detailsTable) {
      const rows = detailsTable.querySelectorAll('tr');
      for (const row of rows) {
        if (row.textContent.toLowerCase().includes('country of origin')) {
          const countryText = row.querySelector('td')?.textContent.trim() || '';
          console.log('Found country in details table:', countryText);
          return countryText;
        }
      }
    }
    
    // Method 2: Look in bullet points
    const bullets = document.querySelectorAll('#feature-bullets li');
    for (const bullet of bullets) {
      const text = bullet.textContent.toLowerCase();
      if (text.includes('made in') || text.includes('country of origin')) {
        const match = text.match(/(?:made in|country of origin)[:\s]+([a-z\s]+)(?:\.|\s|$)/i);
        if (match && match[1]) {
          const countryText = match[1].trim();
          console.log('Found country in bullet points:', countryText);
          return countryText;
        }
      }
    }
    
    // Method 3: Search in any text for common patterns
    const pageText = document.body.textContent.toLowerCase();
    const patterns = [
      /made in china/i,
      /made in usa/i,
      /made in vietnam/i,
      /made in mexico/i,
      /made in japan/i,
      /product of china/i,
      /country of origin:\s*china/i
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(pageText)) {
        const country = pattern.toString().match(/china|usa|vietnam|mexico|japan/i)[0];
        console.log('Found country using pattern search:', country);
        return country;
      }
    }
    
    // If still not found, check brand name for clues
    const brandElement = document.querySelector('#bylineInfo');
    if (brandElement && brandElement.textContent) {
      const brandText = brandElement.textContent.toLowerCase();
      if (brandText.includes('china') || brandText.includes('chinese')) {
        console.log('Brand suggests China origin');
        return 'China';
      } else if (brandText.includes('japan') || brandText.includes('japanese')) {
        console.log('Brand suggests Japan origin');
        return 'Japan';
      }
    }
    
    // For some specific keywords in title that suggest country origin
    const titleLower = (document.getElementById('productTitle')?.textContent || '').toLowerCase();
    if (titleLower.includes('chinese') || 
        (titleLower.includes('led') && titleLower.includes('light')) ||
        titleLower.includes('pinspot') ||
        titleLower.includes('stage light')) {
      console.log('Product title suggests likely China origin');
      return 'China';
    } else if (titleLower.includes('japanese') || 
              titleLower.includes('hario') || 
              titleLower.includes('japanese style') ||
              titleLower.includes('made in japan')) {
      console.log('Product title suggests likely Japan origin');
      return 'Japan';
    }
    
    console.log('No country found, defaulting to Unknown');
    return 'Unknown';
  } catch (error) {
    console.error('Error finding country of origin:', error);
    return 'Unknown';
  }
}

// Fallback calculation - using the direct approach for reliability
// UPDATED with May 2, 2025 tariff rates including de minimis exemption removal
function fallbackCalculation(productData) {
  console.log('Using direct tariff calculation');
  
  const country = productData.countryOfOrigin.toLowerCase();
  const price = productData.price;
  const category = productData.category?.toLowerCase() || '';
  
  // Default values
  let tariffRate = 0;
  let message = '';
  let isSubjectToTariff = false;
  let isPostalShipment = false; // Default assumption for Amazon products
  
  // Check if this is likely a postal shipment based on price and other factors
  // Amazon typically uses courier services, not postal, for marketplace products
  isPostalShipment = price < 100 && !category.includes('electronics') && !category.includes('appliance');
  
  // Top 10 US importers with May 2025 tariff rates
  if (country.includes('china') || country.includes('hong kong')) {
    // China tariff rates after de minimis exemption removal (May 2, 2025)
    if (isPostalShipment) {
      // Postal shipments: 120% tariff or flat $100 fee (increasing to $200 on June 1)
      const flatFeeTariff = 100; // $100 per item
      const percentTariff = price * 1.20; // 120% of value
      
      // Choose the higher of the two options
      if (percentTariff > flatFeeTariff) {
        tariffRate = 1.20; // 120%
        message = 'This product from China is subject to a 120% tariff rate as a postal shipment under the May 2025 trade policy';
      } else {
        // Flat fee equivalent tariff rate
        tariffRate = flatFeeTariff / price;
        message = `This product from China is subject to a $100 flat fee as a postal shipment under the May 2025 trade policy (equivalent to a ${(tariffRate * 100).toFixed(1)}% rate)`;
      }
    } else {
      // Non-postal shipments: full 125% tariff applies
      tariffRate = 1.25; // 125%
      message = 'This product from China is subject to a total 125% tariff rate under the May 2025 trade policy (de minimis exemption removed)';
    }
    isSubjectToTariff = true;
  } 
  else if (country.includes('mexico')) {
    // Check if meets USMCA rules
    if (category.includes('food') || category.includes('produce') || 
        category.includes('vegetable') || category.includes('fruit')) {
      // Food products often exempt under USMCA
      tariffRate = 0;
      isSubjectToTariff = false;
      message = 'This product appears to qualify for USMCA exemption (0% tariff)';
    } else {
      // Non-USMCA compliant goods have 25% tariff
      tariffRate = 0.25;
      isSubjectToTariff = true;
      message = 'This product from Mexico is subject to a 25% tariff on non-USMCA compliant goods';
    }
  }
  else if (country.includes('canada')) {
    // Check if meets USMCA rules
    if (category.includes('food') || category.includes('produce') || 
        category.includes('vegetable') || category.includes('fruit')) {
      // Food products often exempt under USMCA
      tariffRate = 0;
      isSubjectToTariff = false;
      message = 'This product appears to qualify for USMCA exemption (0% tariff)';
    } else if (category.includes('energy') || category.includes('oil') || 
              category.includes('gas') || category.includes('potash')) {
      // Energy and potash from Canada has 10% tariff
      tariffRate = 0.10;
      isSubjectToTariff = true;
      message = 'This product from Canada is subject to a 10% tariff (energy/potash non-USMCA rate)';
    } else {
      // Non-USMCA compliant goods have 25% tariff
      tariffRate = 0.25;
      isSubjectToTariff = true;
      message = 'This product from Canada is subject to a 25% tariff on non-USMCA compliant goods';
    }
  }
  else if (country.includes('japan')) {
    // Japan has a 10% tariff rate (reduced from 24%)
    tariffRate = 0.10;
    isSubjectToTariff = true;
    message = 'This product from Japan is subject to a 10% tariff rate under the May 2025 trade policy';
  }
  else if (country.includes('germany') || country.includes('european union') || 
           country.includes('eu') || country.includes('france') || 
           country.includes('italy') || country.includes('spain')) {
    // European Union has a 20% tariff rate
    tariffRate = 0.20;
    isSubjectToTariff = true;
    message = 'This product from the European Union is subject to a 20% tariff rate under the May 2025 trade policy';
  }
  else if (country.includes('vietnam')) {
    // Vietnam has a 46% tariff rate
    tariffRate = 0.46;
    isSubjectToTariff = true;
    message = 'This product from Vietnam is subject to a 46% tariff rate under the May 2025 trade policy';
  }
  else if (country.includes('south korea') || country.includes('korea')) {
    // South Korea has a 25% tariff rate
    tariffRate = 0.25;
    isSubjectToTariff = true;
    message = 'This product from South Korea is subject to a 25% tariff rate under the May 2025 trade policy';
  }
  else if (country.includes('taiwan')) {
    // Taiwan has a 32% tariff rate
    tariffRate = 0.32;
    isSubjectToTariff = true;
    message = 'This product from Taiwan is subject to a 32% tariff rate under the May 2025 trade policy';
  }
  else if (country.includes('united kingdom') || country.includes('uk')) {
    // UK has a 10% tariff rate
    tariffRate = 0.10;
    isSubjectToTariff = true;
    message = 'This product from the UK is subject to a 10% tariff rate under the May 2025 trade policy';
  }
  else if (country.includes('india')) {
    // India has a 40% tariff rate
    tariffRate = 0.40;
    isSubjectToTariff = true;
    message = 'This product from India is subject to a 40% tariff rate under the May 2025 trade policy';
  }
  else if (country === 'unknown') {
    // Unknown origin, but if it's on Amazon and priced low, likely China
    if (price < 50 && 
        (category.includes('electronics') || 
         category.includes('home') ||
         category.includes('light') ||
         category.includes('tool'))) {
      tariffRate = 1.25; // Assume Chinese origin for low-cost electronics with 125% rate
      isSubjectToTariff = true;
      message = 'Based on the product type and price, this is likely from China and subject to a 125% tariff rate';
    } else {
      // For unknown origin, apply the baseline 10% tariff
      tariffRate = 0.10;
      isSubjectToTariff = true;
      message = 'Country of origin unknown, applying the minimum baseline 10% tariff';
    }
  }
  else {
    // For all other countries, apply the universal 10% baseline tariff
    tariffRate = 0.10;
    isSubjectToTariff = true;
    message = `Products from ${country} are subject to the universal 10% baseline tariff implemented in May 2025`;
  }
  
  // Calculate tariff amount based on pre-tariff price
  const preTariffPrice = price / (1 + tariffRate);
  const tariffAmount = price - preTariffPrice;
  
  return {
    isSubjectToTariff,
    tariffRate,
    preTariffPrice,
    tariffAmount,
    message,
    isFallback: true
  };
}

// Create and show the tariff modal
function showTariffModal(productData, tariffData) {
  console.log('Showing tariff modal');
  try {
    // Remove any existing modal
    const existingModal = document.getElementById('tariff-tax-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Create the modal container
    const modal = document.createElement('div');
    modal.id = 'tariff-tax-modal';
    modal.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      width: 320px;
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      font-family: Arial, sans-serif;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    // Create the modal header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      border-bottom: 1px solid #eee;
      padding-bottom: 15px;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Amazon Tariff Tax Checker';
    title.style.margin = '0';
    title.style.fontSize = '18px';
    title.style.fontWeight = 'bold';
    title.style.color = '#232F3E'; // Amazon's dark blue
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      color: #555;
    `;
    closeButton.onclick = () => modal.remove();
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create the modal content
    const content = document.createElement('div');
    
    // Display product info
    const productInfo = document.createElement('div');
    
    const productTitle = document.createElement('p');
    productTitle.textContent = `Product: ${productData.productTitle.substring(0, 60)}${productData.productTitle.length > 60 ? '...' : ''}`;
    productTitle.style.margin = '0 0 10px 0';
    productTitle.style.fontWeight = 'bold';
    
    const productPrice = document.createElement('p');
    productPrice.textContent = `Listed Price: ${productData.price.toFixed(2)}`;
    productPrice.style.margin = '0 0 10px 0';
    
    productInfo.appendChild(productTitle);
    productInfo.appendChild(productPrice);
    
    // Display country of origin
    const originInfo = document.createElement('div');
    originInfo.style.margin = '15px 0';
    originInfo.style.padding = '10px';
    originInfo.style.backgroundColor = '#f9f9f9';
    originInfo.style.borderRadius = '4px';
    
    const originTitle = document.createElement('p');
    originTitle.textContent = 'Origin Information';
    originTitle.style.margin = '0 0 5px 0';
    originTitle.style.fontWeight = 'bold';
    
    const originCountry = document.createElement('p');
    if (productData.countryOfOrigin && productData.countryOfOrigin !== 'Unknown') {
      originCountry.textContent = `Country of Origin: ${productData.countryOfOrigin.charAt(0).toUpperCase() + productData.countryOfOrigin.slice(1)}`;
    } else {
      originCountry.textContent = 'Country of Origin: Not specified';
      originCountry.style.color = '#e77600'; // Amazon's warning orange
    }
    originCountry.style.margin = '5px 0';
    
    originInfo.appendChild(originTitle);
    originInfo.appendChild(originCountry);
    
    // Display tariff information
    const tariffInfo = document.createElement('div');
    tariffInfo.style.margin = '15px 0';
    tariffInfo.style.padding = '10px';
    tariffInfo.style.backgroundColor = tariffData.isSubjectToTariff ? '#fff4f4' : '#f4fff4';
    tariffInfo.style.borderRadius = '4px';
    
    const tariffTitle = document.createElement('p');
    tariffTitle.textContent = 'Tariff Information';
    tariffTitle.style.margin = '0 0 5px 0';
    tariffTitle.style.fontWeight = 'bold';
    
    const tariffStatus = document.createElement('p');
    tariffStatus.style.margin = '5px 0';
    tariffStatus.style.fontWeight = 'bold';
    
    if (tariffData.isSubjectToTariff) {
      tariffStatus.textContent = 'Subject to tariff tax';
      tariffStatus.style.color = '#B12704'; // Amazon's price red
      
      // Note that tariff is ALREADY included in Amazon's price
      const tariffNote = document.createElement('p');
      tariffNote.textContent = 'The tariff is already built into the Amazon price.';
      tariffNote.style.fontWeight = 'bold';
      tariffNote.style.margin = '10px 0';
      tariffInfo.appendChild(tariffNote);
      
      // Show approximate breakdown
      const preTariffPrice = document.createElement('p');
      preTariffPrice.textContent = `Estimated price before tariff: ${tariffData.preTariffPrice.toFixed(2)}`;
      preTariffPrice.style.margin = '5px 0';
      tariffInfo.appendChild(preTariffPrice);
      
      const tariffAmount = document.createElement('p');
      tariffAmount.textContent = `Estimated tariff amount: ${tariffData.tariffAmount.toFixed(2)}`;
      tariffAmount.style.cssText = `
        margin: 5px 0;
        color: #B12704;
        font-weight: bold;
      `;
      tariffInfo.appendChild(tariffAmount);
      
      const tariffRate = document.createElement('p');
      tariffRate.textContent = `(${(tariffData.tariffRate * 100).toFixed(1)}% tariff rate)`;
      tariffRate.style.cssText = `
        margin: 0 0 10px 0;
        font-size: 12px;
        color: #666;
      `;
      tariffInfo.appendChild(tariffRate);
      
      // Final price (which is the displayed Amazon price)
      const amazonPrice = document.createElement('p');
      amazonPrice.textContent = `Price with tariff (what you see): ${productData.price.toFixed(2)}`;
      amazonPrice.style.fontWeight = 'bold';
      amazonPrice.style.margin = '10px 0 5px 0';
      tariffInfo.appendChild(amazonPrice);
    } else {
      tariffStatus.textContent = 'Not subject to tariff tax';
      tariffStatus.style.color = '#007600'; // Amazon's success green
    }
    
    tariffInfo.appendChild(tariffTitle);
    tariffInfo.appendChild(tariffStatus);
    
    // Add explanation
    const explanation = document.createElement('div');
    explanation.style.marginTop = '15px';
    
    const explanationText = document.createElement('p');
    explanationText.textContent = tariffData.message;
    explanationText.style.margin = '0';
    explanationText.style.fontSize = '13px';
    
    // Add additional explanation about import price inclusion
    const additionalExplanation = document.createElement('p');
    additionalExplanation.textContent = 'Import tariffs are typically paid by the importer and included in the final retail price.';
    additionalExplanation.style.margin = '10px 0 0 0';
    additionalExplanation.style.fontSize = '13px';
    additionalExplanation.style.fontStyle = 'italic';
    
    // Add note about tariff implementation date
    const tariffDateNote = document.createElement('p');
    tariffDateNote.textContent = 'Tariff rates reflect the May 2, 2025 trade policy changes including de minimis exemption removal for China.';
    tariffDateNote.style.margin = '5px 0 0 0';
    tariffDateNote.style.fontSize = '12px';
    tariffDateNote.style.fontStyle = 'italic';
    
    explanation.appendChild(explanationText);
    explanation.appendChild(additionalExplanation);
    explanation.appendChild(tariffDateNote);
    
    // Add a disclaimer
    const disclaimer = document.createElement('p');
    disclaimer.textContent = 'This is an estimate based on public tariff information. Actual tariffs may vary and are determined by customs authorities.';
    disclaimer.style.cssText = `
      margin-top: 15px;
      font-size: 11px;
      color: #666;
      font-style: italic;
    `;
    
    // Add data source info
    const dataSourceNote = document.createElement('p');
    dataSourceNote.textContent = 'Using data from U.S. Customs and Border Protection, the White House, and Office of the U.S. Trade Representative. Last updated: May 2, 2025';
    dataSourceNote.style.cssText = `
      margin-top: 5px;
      font-size: 10px;
      color: #999;
    `;
    
    // Assemble the modal
    content.appendChild(productInfo);
    content.appendChild(originInfo);
    content.appendChild(tariffInfo);
    content.appendChild(explanation);
    
    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(disclaimer);
    modal.appendChild(dataSourceNote);
    
    // Add the modal to the page
    document.body.appendChild(modal);
    console.log('Modal added to page');
    
    // Auto-close the modal after 60 seconds
    setTimeout(() => {
      if (document.getElementById('tariff-tax-modal')) {
        modal.remove();
      }
    }, 60000);
  } catch (error) {
    console.error('Error showing modal:', error);
  }
}

// Run automatic check when the page loads
window.addEventListener('load', function() {
  console.log('Page loaded, waiting to run automatic check');
  setTimeout(() => {
    console.log('Running automatic check');
    try {
      const productData = extractProductData();
      console.log('Auto-check product data:', productData);
      
      if (!productData.error) {
        // Use direct calculation for reliability
        const tariffData = fallbackCalculation(productData);
        console.log('Auto-check tariff data:', tariffData);
        
        if (tariffData.isSubjectToTariff) {
          showTariffModal(productData, tariffData);
        }
      }
    } catch (error) {
      console.error('Error in automatic check:', error);
    }
  }, 2000); // Give the page more time to fully load
});

console.log('Content script loaded successfully with tariff data updated for May 2, 2025');