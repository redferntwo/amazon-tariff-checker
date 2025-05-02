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




document.addEventListener('DOMContentLoaded', function() {
  const checkButton = document.getElementById('checkTariff');
  const statusDiv = document.getElementById('status');
  const resultDiv = document.getElementById('result');
  const productInfoDiv = document.getElementById('productInfo');
  const tariffStatusDiv = document.getElementById('tariffStatus');
  const tariffAmountDiv = document.getElementById('tariffAmount');
  
  // Initialize popup
  initializePopup();
  
  checkButton.addEventListener('click', async function() {
    // Set button to loading state
    checkButton.disabled = true;
    checkButton.textContent = 'Checking...';
    
    // Clear previous results
    statusDiv.textContent = 'Checking product...';
    resultDiv.classList.add('hidden');
    tariffStatusDiv.textContent = '';
    tariffAmountDiv.textContent = '';
    tariffAmountDiv.classList.add('hidden');
    
    // Get the current active tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on an Amazon product page
      if (!tab.url.includes('amazon.com') || !tab.url.includes('/dp/')) {
        statusDiv.textContent = 'Not an Amazon product page';
        resetButton();
        return;
      }
      
      // Add a timeout to ensure we don't wait forever
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), 5000);
      });
      
      try {
        // First check if a modal already exists
        const modalCheckResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: function() {
            return document.getElementById('tariff-tax-modal') !== null;
          }
        });
        
        const modalExists = modalCheckResult[0].result;
        
        if (modalExists) {
          // If modal exists, tell user it's there and update or remove it
          const refreshResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: function() {
              // Get the modal
              const modal = document.getElementById('tariff-tax-modal');
              
              // Make it flash to draw attention
              const originalBackground = modal.style.backgroundColor;
              modal.style.backgroundColor = '#FFEB3B'; // Yellow highlight
              
              // Scroll to ensure modal is visible
              modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Reset background after a moment
              setTimeout(() => {
                modal.style.backgroundColor = originalBackground;
              }, 1500);
              
              return true;
            }
          });
          
          if (refreshResult[0].result) {
            statusDiv.textContent = 'Tariff information is already on the page (highlighted)';
            resetButton();
            return;
          }
        }
        
        // Inject the main tariff checking script
        const resultPromise = chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['scripts/content-injection.js']
        });
        
        // Race between the execution and timeout
        await Promise.race([resultPromise, timeoutPromise]);
        
        // If execution completed, show success message
        statusDiv.textContent = 'Tariff information displayed on page';
        
      } catch (error) {
        // Handle specific errors
        console.error('Execution error:', error);
        
        if (error.message.includes('tariffModal') || error.message.includes('not defined')) {
          // This is likely happening because the script couldn't be injected properly
          // Try refreshing the page
          statusDiv.textContent = 'Please refresh the Amazon page to see tariff information';
          
          // Add a refresh button
          const refreshButton = document.createElement('button');
          refreshButton.textContent = 'Refresh Page';
          refreshButton.style.marginLeft = '10px';
          refreshButton.onclick = async () => {
            await chrome.tabs.reload(tab.id);
            window.close(); // Close the popup
          };
          
          statusDiv.appendChild(refreshButton);
        } else {
          statusDiv.textContent = 'Error: ' + (error.message || 'Could not check tariff status');
        }
      }
    } catch (error) {
      statusDiv.textContent = 'Error: Could not access tab';
      console.error('Tab access error:', error);
    }
    
    // Reset button state
    resetButton();
  });
  
  function resetButton() {
    checkButton.disabled = false;
    checkButton.textContent = 'Check Tariff';
  }
  
  function initializePopup() {
    // Check if there's already a modal on the page
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0] && tabs[0].url.includes('amazon.com')) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: function() {
            return document.getElementById('tariff-tax-modal') !== null;
          }
        }, function(results) {
          if (results && results[0] && results[0].result) {
            // If modal exists, show a different message
            statusDiv.textContent = 'Tariff information is already displayed on the page';
            checkButton.textContent = 'Highlight Tariff Info';
          }
        });
      }
    });
    
    // Display current tariff data version
    const dataVersionElement = document.createElement('div');
    dataVersionElement.classList.add('tariff-data-version');
    dataVersionElement.textContent = 'Tariff data updated: May 2, 2025 (de minimis changes now in effect)';
    dataVersionElement.style.fontSize = '11px';
    dataVersionElement.style.marginTop = '12px';
    dataVersionElement.style.textAlign = 'center';
    dataVersionElement.style.fontStyle = 'italic';
    dataVersionElement.style.color = '#B12704';
    document.querySelector('.container').appendChild(dataVersionElement);
  }
});