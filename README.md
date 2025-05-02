# amazon-tariff-checker
A Chrome extension that checks if products on Amazon.com are subject to tariff fees when shipping to the US.

Created by [The Dual Lens ](https://duallens.substack.com)

## Features

- Automatically detects when you're viewing a product on Amazon.com
- Analyzes the product page to determine if tariff taxes apply for US shipping
- Displays a clear notification about potential additional costs
- Helps shoppers avoid unexpected charges at checkout or delivery

## Installation Instructions

Since this extension isn't published on the Chrome Web Store, you'll need to install it in "Developer Mode". Here's how:

### Step 1: Download the Extension

1. Clone this repository or download it as a ZIP file
   ```
   git clone https://github.com/yourusername/amazon-tariff-checker.git
   ```
   
   Or download and extract the ZIP file from the repository

### Step 2: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top-right corner
3. Click "Load unpacked"
4. Browse to the directory where you downloaded/cloned this repository
5. Select the folder and click "Open"

The extension should now appear in your extensions list and be active!

### Step 3: Test the Extension

1. Visit [Amazon.com](https://www.amazon.com)
2. Navigate to any product page
3. The extension will automatically check if the product is likely to incur tariff taxes
4. Look for the notification banner at the top of the product page

## How It Works

This extension:
1. Detects when you're on a product page on Amazon.com
2. Looks for product information like the seller, shipping details, and price that is already visible on the page
3. Analyzes these details to determine if tariff taxes might apply when shipping to the US
4. Displays a warning if additional charges are likely when importing to the US

Note: This extension only processes information already visible on the pages you visit manually. It does not scrape data beyond what you're viewing, does not collect personal information, and does not send data to any external servers. All processing occurs locally in your browser.

## Contributing

Contributions are welcome! Feel free to fork this repository and submit pull requests.

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some feature'`)
5. Push to the branch (`git push origin feature/your-feature`)
6. Open a Pull Request

For any questions or suggestions, feel free to reach out to me on my blog at [Dual Lens](https://duallens.substack.com) or open an issue in this repository.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

```
MIT License

Copyright (c) 2025 The Dual Lens 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Disclaimer

This extension provides an estimate based on product information available on Amazon.com. It cannot guarantee 100% accuracy as tariff regulations may change and product details may be incomplete. Always check official customs information for your country before making a purchase.
