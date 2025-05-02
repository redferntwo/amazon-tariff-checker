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

/**
 * Tariff API Connector
 * 
 * This file handles the connection to public tariff data APIs
 * to get up-to-date tariff information using the USITC HTS API.
 */

// Cache for tariff data to avoid unnecessary API calls
const tariffCache = {
  data: {},
  timestamp: 0,
  CACHE_DURATION: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
};

/**
 * Get tariff information for a product
 * @param {Object} productData - Data about the product
 * @returns {Promise<Object>} - Tariff information
 */
async function getTariffInfo(productData) {
  try {
    // Extract all product data we can find
    const enrichedData = await enrichProductData(productData);

    // Construct a more precise cache key based on multiple product attributes
    const cacheKey = constructCacheKey(enrichedData);
    
    // Check cache before making API requests
    if (hasCachedTariffData(cacheKey)) {
      return getCachedTariffData(cacheKey, enrichedData.price);
    }
    
    // Get tariff data from the USITC HTS API
    const tariffData = await fetchTariffData(enrichedData);
    
    // Cache the result
    cacheTariffData(cacheKey, tariffData);
    
    // Calculate the tariff amount based on the product price
    const tariffAmount = enrichedData.price * tariffData.rate;
    
    return {
      isSubjectToTariff: tariffData.rate > 0,
      tariffAmount: tariffAmount,
      tariffRate: tariffData.rate,
      message: tariffData.message,
      htsCode: tariffData.htsCode || enrichedData.htsCode,
      countryOfOrigin: enrichedData.countryOfOrigin,
      productDetails: tariffData.productDetails || {}
    };
  } catch (error) {
    console.error('Error getting tariff information:', error);
    // Fallback to basic country-based tariff check if API fails
    return fallbackTariffCheck(productData);
  }
}

/**
 * Enrich product data with additional information needed for tariff calculation
 * @param {Object} productData - Initial product data
 * @returns {Promise<Object>} - Enriched product data
 */
async function enrichProductData(productData) {
  const enriched = {...productData};
  
  // Normalize country of origin
  enriched.countryOfOrigin = normalizeCountryName(productData.countryOfOrigin);
  
  // Try to determine the HTS code
  if (!enriched.htsCode) {
    enriched.htsCode = await determineHTSCode(productData);
  }
  
  // Extract additional product attributes that might affect tariff rates
  enriched.attributes = extractProductAttributes(productData);
  
  return enriched;
}

/**
 * Extract product attributes that might affect tariff classification
 * @param {Object} productData - Product data
 * @returns {Object} - Product attributes
 */
function extractProductAttributes(productData) {
  const attributes = {};
  
  // Extract from title and description
  const title = productData.productTitle || '';
  const description = productData.description || '';
  const combinedText = title + ' ' + description;
  
  // Material composition
  const materials = [
    'cotton', 'wool', 'silk', 'leather', 'plastic', 'metal', 'aluminum', 
    'steel', 'wood', 'glass', 'ceramic', 'rubber', 'polyester', 'nylon'
  ];
  
  materials.forEach(material => {
    const regex = new RegExp(`\\b${material}\\b`, 'i');
    if (regex.test(combinedText)) {
      attributes.material = attributes.material || [];
      attributes.material.push(material.toLowerCase());
    }
  });
  
  // Check for electronics/electrical
  if (/electronic|electrical|battery|powered|rechargeable|digital|smart|wifi|bluetooth/i.test(combinedText)) {
    attributes.isElectronic = true;
  }
  
  // Check for clothing/apparel
  if (/shirt|pants|dress|jacket|coat|sweater|clothing|wear|apparel|garment/i.test(combinedText)) {
    attributes.isApparel = true;
    
    // Gender specificity for apparel
    if (/men|man|boy|male/i.test(combinedText)) {
      attributes.gender = 'male';
    } else if (/women|woman|girl|female/i.test(combinedText)) {
      attributes.gender = 'female';
    } else {
      attributes.gender = 'unisex';
    }
  }
  
  // Check for food products
  if (/food|edible|organic|snack|beverage|drink|ingredient/i.test(combinedText)) {
    attributes.isFood = true;
  }
  
  return attributes;
}

/**
 * Create a cache key from product data
 * @param {Object} productData - Enriched product data
 * @returns {string} - Cache key
 */
function constructCacheKey(productData) {
  const parts = [
    productData.countryOfOrigin || 'unknown',
    productData.htsCode || 'unknown'
  ];
  
  // Add specific attributes that might affect tariff rates
  if (productData.attributes) {
    if (productData.attributes.material && productData.attributes.material.length > 0) {
      parts.push('mat:' + productData.attributes.material.join('-'));
    }
    
    if (productData.attributes.isElectronic) {
      parts.push('elec');
    }
    
    if (productData.attributes.isApparel && productData.attributes.gender) {
      parts.push('app-' + productData.attributes.gender);
    }
    
    if (productData.attributes.isFood) {
      parts.push('food');
    }
  }
  
  return parts.join('-');
}

/**
 * Determine the HTS code for a product
 * @param {Object} productData - Product data
 * @returns {Promise<string>} - HTS code
 */
async function determineHTSCode(productData) {
  try {
    // First try category mapping
    const basicCode = getCategoryHTSCode(productData.category);
    if (basicCode !== '9999') {
      return basicCode;
    }
    
    // If category mapping fails, try keyword analysis
    return getHTSCodeFromKeywords(productData);
  } catch (error) {
    console.error('Error determining HTS code:', error);
    return '9999'; // Default unknown category
  }
}

/**
 * Get an HTS code based on Amazon category
 * @param {string} category - Amazon category
 * @returns {string} - HTS code (at least the chapter)
 */
function getCategoryHTSCode(category) {
  if (!category) return '9999';
  
  const normalized = category.toLowerCase().trim();
  
  // Map of common Amazon categories to Harmonized Tariff Schedule chapters/headings
  // This is a simplified mapping - a production implementation would be more comprehensive
  const categoryMap = {
    // Electronics
    'electronics': '85',
    'headphones': '8518.30',
    'computers': '8471',
    'laptops': '8471.30',
    'tablets': '8471.30',
    'cell phones': '8517.12',
    'smartphone': '8517.12',
    'tvs': '8528.72',
    'television': '8528.72',
    'monitors': '8528.52',
    'printers': '8443.31',
    'cameras': '8525.80',
    
    // Apparel
    'clothing': '61',
    'apparel': '61',
    'shirts': '6105',
    't-shirts': '6109.10',
    'pants': '6203',
    'socks': '6115',
    'shoes': '64',
    'footwear': '64',
    'boots': '6403',
    'sneakers': '6404',
    
    // Home goods
    'furniture': '94',
    'chairs': '9401',
    'tables': '9403',
    'lamps': '9405',
    'kitchenware': '7323',
    'cookware': '7323',
    'cutlery': '8211',
    'bedding': '6302',
    'towels': '6302',
    
    // Miscellaneous
    'toys': '95',
    'games': '9504',
    'sporting goods': '9506',
    'books': '4901',
    'jewelry': '7113',
    'watches': '9102',
    'cosmetics': '3304',
    'beauty': '33',
    'perfume': '3303',
    'tools': '8205',
    'hardware': '8302',
    'automotive': '8708',
    'pet supplies': '4201',
    'luggage': '4202',
    'bags': '4202',
    'food': '21',
    'coffee': '0901',
    'tea': '0902'
  };
  
  // Try to find an exact match
  if (categoryMap[normalized]) {
    return categoryMap[normalized];
  }
  
  // Try to find a partial match
  for (const [key, value] of Object.entries(categoryMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  // If we can't find a match, return a default code
  return '9999';
}

/**
 * Analyze product title and description to determine HTS code
 * @param {Object} productData - Product data
 * @returns {string} - HTS code
 */
function getHTSCodeFromKeywords(productData) {
  const title = productData.productTitle || '';
  const description = productData.description || '';
  const combinedText = title + ' ' + description;
  
  // Common product types and their associated HTS codes
  const keywordMap = {
    // Electronics
    'phone|smartphone|mobile phone': '8517.12',
    'laptop|notebook computer': '8471.30',
    'desktop computer|pc tower': '8471.41',
    'tablet|ipad': '8471.30',
    'tv|television|smart tv': '8528.72',
    'monitor|computer screen': '8528.52',
    'earbuds|headphones|earphones': '8518.30',
    'speaker|audio speaker': '8518.22',
    'camera|digital camera': '8525.80',
    'battery|rechargeable': '8507',
    'charger|power adapter': '8504.40',
    'cable|usb cable': '8544.42',
    'printer|scanner': '8443.31',
    
    // Apparel
    'shirt|tshirt|top': '6109',
    'pants|trousers|jeans': '6203',
    'shorts': '6204',
    'dress|gown': '6204',
    'jacket|coat': '6201',
    'sweater|pullover': '6110',
    'underwear|briefs': '6107',
    'socks': '6115',
    'shoes|footwear': '6404',
    'boots': '6403',
    'hat|cap': '6505',
    'gloves': '6116',
    'scarf': '6117',
    
    // Home goods
    'chair|stool': '9401',
    'table|desk': '9403',
    'bed|mattress': '9404',
    'sofa|couch': '9401.61',
    'lamp|lighting': '9405',
    'curtain|drapes': '6303',
    'rug|carpet': '5705',
    'blanket|throw': '6301',
    'towel': '6302',
    'plates|dishes': '6911',
    'cookware|pots|pans': '7323',
    'utensils|flatware': '8215',
    'knife|knives': '8211',
    
    // Coffee related items
    'coffee maker|coffee machine|coffee brewer': '8516.71',
    'coffee grinder': '8509.40',
    'coffee dripper|pour over|drip coffee': '7323.93',
    'coffee filter': '4823.20',
    'coffee server|coffee carafe': '7013.37',
    
    // Miscellaneous
    'toy|action figure': '9503',
    'game|board game': '9504',
    'book|novel': '4901',
    'backpack|bag': '4202',
    'watch|wristwatch': '9102',
    'jewelry|necklace': '7113',
    'wallet|purse': '4202',
    'sunglasses': '9004',
    'umbrella': '6601',
    'pen|pencil': '9608',
    'paper|notebook': '4820',
    'tool|hammer|screwdriver': '8205',
    'pet|dog|cat': '4201'
  };
  
  // Check each keyword pattern against the combined text
  for (const [keywordPattern, htsCode] of Object.entries(keywordMap)) {
    const keywordRegex = new RegExp(`\\b(${keywordPattern})\\b`, 'i');
    if (keywordRegex.test(combinedText)) {
      return htsCode;
    }
  }
  
  // Default code if no matches found
  return '9999';
}

/**
 * Normalize a country name to match what the API expects
 * @param {string} countryName - Raw country name from the product page
 * @returns {string} - Normalized country name
 */
function normalizeCountryName(countryName) {
  if (!countryName) return '';
  
  const normalized = countryName.toLowerCase().trim();
  
  // Map of common alternative names to standardized names
  const countryMap = {
    'cn': 'china',
    'prc': 'china',
    'people\'s republic of china': 'china',
    'usa': 'united states',
    'us': 'united states',
    'u.s.': 'united states',
    'u.s.a.': 'united states',
    'america': 'united states',
    'uk': 'united kingdom',
    'great britain': 'united kingdom',
    'deutschland': 'germany',
    'vn': 'vietnam',
    'kr': 'south korea',
    'dprk': 'north korea',
    'roc': 'taiwan',
    'taipei': 'taiwan',
    'mx': 'mexico',
    'ca': 'canada',
    'jp': 'japan',
    'sk': 'south korea',
    'republic of korea': 'south korea',
    'my': 'malaysia',
    'th': 'thailand',
    'id': 'indonesia',
    'in': 'india',
    'br': 'brazil',
    'de': 'germany',
    'fr': 'france',
    'it': 'italy',
    'es': 'spain',
    'se': 'sweden',
    'pl': 'poland',
    'tr': 'turkey',
    'turkiye': 'turkey',
    'ru': 'russia',
    'russian federation': 'russia',
    'viet nam': 'vietnam'
  };
  
  return countryMap[normalized] || normalized;
}

/**
 * Fetch tariff data from the USITC HTS API
 * @param {Object} productData - Product data including country and HTS code
 * @returns {Promise<Object>} - Tariff data
 */
async function fetchTariffData(productData) {
  try {
    // For demonstration purposes, we're simulating the API response
    // This would be replaced with a real API call in production
    // The USITC provides an API through https://hts.usitc.gov/ or data.gov
    
    // In a real implementation, the API call might look something like this:
    /*
    const url = `https://api.usitc.gov/tariff/v1/hts/${productData.htsCode}?country=${productData.countryOfOrigin}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    const data = await response.json();
    return processApiResponse(data, productData);
    */
    
    // Simulated API call with delay
    return new Promise(resolve => {
      setTimeout(() => {
        // Get base tariff rate for the HTS code
        const baseTariff = getBaseTariffRate(productData.htsCode);
        
        // Adjust for country-specific rates
        const { rate, message } = adjustTariffForCountry(baseTariff, productData);
        
        // Check for additional special tariffs or exclusions
        const { finalRate, finalMessage, details } = applySpecialTariffs(rate, message, productData);
        
        resolve({
          rate: finalRate,
          message: finalMessage,
          htsCode: productData.htsCode,
          productDetails: details
        });
      }, 300);
    });
  } catch (error) {
    console.error('Error fetching tariff data:', error);
    // Return a default tariff response
    return {
      rate: 0,
      message: 'Error fetching tariff data',
      htsCode: productData.htsCode || '9999'
    };
  }
}

/**
 * Get the base tariff rate for an HTS code
 * @param {string} htsCode - HTS code
 * @returns {number} - Base tariff rate
 */
function getBaseTariffRate(htsCode) {
  // This would typically come from the USITC HTS database
  // For demonstration, we'll use some common rates
  
  // Get just the chapter (first 2 digits)
  const chapter = htsCode.substring(0, 2);
  
  // Base rates by chapter (very simplified)
  const chapterRates = {
    '61': 0.16, // Apparel, knitted or crocheted
    '62': 0.16, // Apparel, not knitted or crocheted
    '64': 0.20, // Footwear
    '42': 0.08, // Leather goods
    '85': 0.02, // Electrical machinery
    '84': 0.02, // Machinery
    '90': 0.02, // Optical, photographic, precision instruments
    '95': 0.04, // Toys, games
    '71': 0.07, // Jewelry
    '39': 0.05, // Plastics
    '94': 0.03, // Furniture
    '73': 0.02, // Iron/steel articles
    '48': 0.00, // Paper
    '49': 0.00, // Books
    '82': 0.04, // Tools
    '87': 0.03, // Vehicles
    '33': 0.02, // Cosmetics
    '69': 0.06, // Ceramics
    '70': 0.05, // Glass
    '83': 0.05, // Misc. base metal articles
    '96': 0.04, // Miscellaneous manufactured articles
    '44': 0.03, // Wood
    '63': 0.07, // Other textile articles
    '65': 0.06, // Headgear
    '91': 0.03, // Clocks/watches
    '92': 0.04, // Musical instruments
    '09': 0.00, // Coffee, tea, spices
    '21': 0.02, // Misc. edible preparations
    '22': 0.03  // Beverages
  };
  
  // Return the chapter rate if found, otherwise a default rate
  return chapterRates[chapter] || 0.03;
}

/**
 * Adjust the tariff rate based on the country of origin
 * @param {number} baseRate - Base tariff rate
 * @param {Object} productData - Product data
 * @returns {Object} - Adjusted rate and message
 */
function adjustTariffForCountry(baseRate, productData) {
  const country = productData.countryOfOrigin;
  const htsCode = productData.htsCode;
  const chapter = htsCode.substring(0, 2);
  
  // Countries with higher tariffs due to the April 2025 "Liberation Day" tariffs
  if (country === 'china') {
    // China has a 34% tariff + existing 20% = 54% total
    return { 
      rate: 0.54, 
      message: 'This product from China is subject to a combined 54% tariff rate (34% reciprocal + 20% existing tariffs)'
    };
  } 
  else if (country === 'japan') {
    // Japan has a 10% baseline tariff rate (reduced from 24% for 90 days)
    return { 
      rate: 0.10, 
      message: 'This product from Japan is subject to a 10% baseline tariff rate under the April 2025 tariff policy (reduced from 24% for 90 days)'
    };
  }
  else if (country === 'south korea' || country === 'korea') {
    // South Korea has a 25% tariff rate
    return { 
      rate: 0.25, 
      message: 'This product from South Korea is subject to a 25% tariff rate under the April 2025 tariff policy'
    };
  }
  else if (country === 'taiwan') {
    // Taiwan has a 32% tariff rate
    return { 
      rate: 0.32, 
      message: 'This product from Taiwan is subject to a 32% tariff rate under the April 2025 tariff policy'
    };
  }
  else if (country === 'european union' || country === 'eu' || 
           country === 'germany' || country === 'france' || 
           country === 'italy' || country === 'spain') {
    // EU has a 20% tariff rate
    return { 
      rate: 0.20, 
      message: 'This product from the European Union is subject to a 20% tariff rate under the April 2025 tariff policy'
    };
  }
  else if (country === 'vietnam') {
    // Vietnam has a 46% tariff rate
    return { 
      rate: 0.46, 
      message: 'This product from Vietnam is subject to a 46% tariff rate under the April 2025 tariff policy'
    };
  }
  else if (country === 'india') {
    // India has a 40% tariff rate
    return { 
      rate: 0.40, 
      message: 'This product from India is subject to a 40% tariff rate under the April 2025 tariff policy'
    };
  }
  else if (country === 'indonesia') {
    // Indonesia has a 32% tariff rate
    return { 
      rate: 0.32, 
      message: 'This product from Indonesia is subject to a 32% tariff rate under the April 2025 tariff policy'
    };
  }
  else if (country === 'thailand') {
    // Thailand has a 20% tariff rate
    return { 
      rate: 0.20, 
      message: 'This product from Thailand is subject to a 20% tariff rate under the April 2025 tariff policy'
    };
  }
  else if (country === 'malaysia') {
    // Malaysia has a 25% tariff rate
    return { 
      rate: 0.25, 
      message: 'This product from Malaysia is subject to a 25% tariff rate under the April 2025 tariff policy'
    };
  }
  
  // Free trade agreement countries
  const ftaCountries = [
    'canada', 'mexico', 'australia', 'bahrain', 'chile', 
    'colombia', 'israel', 'jordan', 'morocco', 'oman', 
    'panama', 'peru', 'singapore'
  ];
  
  // Check for FTA countries - USMCA
  if (country === 'mexico' || country === 'canada') {
    return { 
      rate: 0.25, 
      message: `This product from ${country} is subject to a 25% tariff under the 2025 USMCA revisions`
    };
  }
  
  // Check for other FTA countries
  if (ftaCountries.includes(country)) {
    // For all other countries, apply the baseline 10% universal tariff
    return { 
      rate: 0.10, 
      message: `Products from ${country} are subject to the universal 10% baseline tariff implemented in April 2025`
    };
  }
  
  // Default case: use the 10% baseline tariff
  return { 
    rate: 0.10, 
    message: `Products from ${country} are subject to the universal 10% baseline tariff implemented in April 2025`
  };
}

/**
 * Apply any special tariffs or exclusions
 * @param {number} rate - Current tariff rate
 * @param {string} message - Current message
 * @param {Object} productData - Product data
 * @returns {Object} - Final rate, message, and details
 */
function applySpecialTariffs(rate, message, productData) {
  // No special tariffs or exemptions, just return the original rate and message
  return {
    finalRate: rate,
    finalMessage: message,
    details: {}
  };
}

/**
 * Fallback method to determine if a product is subject to tariffs
 * based on country of origin when API requests fail
 * @param {Object} productData - Product data
 * @returns {Object} - Basic tariff information
 */
function fallbackTariffCheck(productData) {
  const country = normalizeCountryName(productData.countryOfOrigin);
  const price = productData.price;
  
  // Default values
  let tariffRate = 0;
  let message = '';
  let isSubjectToTariff = false;
  
  // Check if the country is included in the April 2025 "Liberation Day" tariff schedule
  if (country === 'china') {
    // China has a 34% tariff + existing 20% = 54% total
    tariffRate = 0.54;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from China is subject to a combined 54% tariff rate (34% reciprocal + 20% existing tariffs)';
  } 
  else if (country === 'japan') {
    // Japan has a 10% baseline tariff rate as of May 2025 (initially was 24% but reduced for 90 days)
    tariffRate = 0.10;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from Japan is subject to a 10% baseline tariff rate under the April 2025 tariff policy (reduced from 24% for 90 days)';
  }
  else if (country === 'south korea' || country === 'korea') {
    // South Korea has a 25% tariff rate
    tariffRate = 0.25;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from South Korea is subject to a 25% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'taiwan') {
    // Taiwan has a 32% tariff rate
    tariffRate = 0.32;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from Taiwan is subject to a 32% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'european union' || country === 'eu' || 
          country === 'germany' || country === 'france' || 
          country === 'italy' || country === 'spain') {
    // EU has a 20% tariff rate
    tariffRate = 0.20;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from the European Union is subject to a 20% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'vietnam') {
    // Vietnam has a 46% tariff rate
    tariffRate = 0.46;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from Vietnam is subject to a 46% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'india') {
    // India has a 40% tariff rate
    tariffRate = 0.40;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from India is subject to a 40% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'brazil') {
    // Brazil has a 10% tariff rate
    tariffRate = 0.10;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from Brazil is subject to a 10% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'indonesia') {
    // Indonesia has a 32% tariff rate
    tariffRate = 0.32;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from Indonesia is subject to a 32% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'thailand') {
    // Thailand has a 20% tariff rate
    tariffRate = 0.20;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from Thailand is subject to a 20% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'malaysia') {
    // Malaysia has a 25% tariff rate
    tariffRate = 0.25;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from Malaysia is subject to a 25% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'mexico' || country === 'canada') {
    // Not exempt, subject to the 25% USMCA tariff
    tariffRate = 0.25;
    isSubjectToTariff = true;
    message = `Using fallback data: This product from ${country} is subject to a 25% tariff under the 2025 USMCA revisions`;
  }
  else if (country === 'united kingdom' || country === 'uk') {
    // UK has a 10% tariff rate
    tariffRate = 0.10;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from the UK is subject to a 10% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'australia') {
    // Australia has a 10% tariff rate
    tariffRate = 0.10;
    isSubjectToTariff = true;
    message = 'Using fallback data: This product from Australia is subject to a 10% tariff rate under the April 2025 tariff policy';
  }
  else if (country === 'unknown') {
    // For unknown origin, apply the baseline 10% tariff
    tariffRate = 0.10;
    isSubjectToTariff = true;
    message = 'Using fallback data: Country of origin unknown, applying the minimum baseline 10% tariff';
  }
  else {
    // For all other countries, apply the baseline 10% universal tariff
    tariffRate = 0.10;
    isSubjectToTariff = true;
    message = `Using fallback data: Products from ${country} are subject to the universal 10% baseline tariff implemented in April 2025`;
  }
  
  // Calculate tariff amount based on price
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

/**
 * Check if we have cached tariff data for the given key
 * @param {string} cacheKey - Cache key
 * @returns {boolean} - Whether we have valid cached data
 */
function hasCachedTariffData(cacheKey) {
  const now = Date.now();
  
  // Check if cache is expired
  if (now - tariffCache.timestamp > tariffCache.CACHE_DURATION) {
    tariffCache.data = {};
    tariffCache.timestamp = now;
    return false;
  }
  
  return !!tariffCache.data[cacheKey];
}

/**
 * Get cached tariff data
 * @param {string} cacheKey - Cache key
 * @param {number} price - Product price
 * @returns {Object} - Tariff information
 */
function getCachedTariffData(cacheKey, price) {
  const tariffData = tariffCache.data[cacheKey];
  const tariffAmount = price * tariffData.rate;
  
  return {
    isSubjectToTariff: tariffData.rate > 0,
    tariffAmount: tariffAmount,
    tariffRate: tariffData.rate,
    message: tariffData.message,
    productDetails: tariffData.productDetails || {}
  };
}

/**
 * Cache tariff data
 * @param {string} cacheKey - Cache key
 * @param {Object} tariffData - Tariff data to cache
 */
function cacheTariffData(cacheKey, tariffData) {
  tariffCache.data[cacheKey] = tariffData;
  tariffCache.timestamp = Date.now();
}