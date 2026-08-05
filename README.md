# RZpoS

Project Overview



Build a production-ready, offline-first, cloud-enabled Point of Sale (POS) and Inventory Management System called ZPOS, intended to be deployed in vercel for hosting even through it will also live in lovable ,developed and owned by Zetiora AI Technologies.



ZPOS is NOT a simple POS application.



It is a professional Business Management Platform that enables businesses to manage products, inventory, sales, customers, expenses, employees, and business reports from one place.



The application must feel like a polished commercial product suitable for real businesses.



The UI should be modern, elegant, premium, responsive, and mobile-friendly.



Use a Premium Black & Gold design theme.





---



Core Architecture



The application MUST be built using an Offline-First Architecture.



Business operations must continue working even without internet.



Internet should only be used for:



Authentication



Data synchronization



Subscription verification





Everything else should continue working offline.



The application must later be packaged as an Android app using Capacitor, therefore it must be fully compatible with Capacitor from the beginning.





---



Authentication



This is a Closed SaaS Platform.



There must be NO public registration.



Only the System Administrator can create organizations and their owner accounts.



Landing page:



Only a Login page.



Login page should include:



Beautiful business-themed background image



Premium dark overlay



ZPOS Logo



Powered by Zetiora AI Technologies



Email/Phone login



Password



Remember Me



Forgot Password





No Signup button.





---



System Administrator



Create a complete Super Admin Dashboard.



Super Admin can:



Create Organization



Edit Organization



Suspend Organization



Activate Organization



Delete Organization



Reset Password



View all organizations





While creating an organization collect:



Business Name



Owner Name



Phone



Email



Address



Business Category





Automatically create Owner login credentials.





---



Organization



Each organization must have completely isolated data.



Organizations cannot access each other's information.



Each organization gets its own dashboard.





---



Dashboard



Display:



Today's Sales



Revenue



Profit



Products



Low Stock



Recent Sales





Include modern charts.





---



Product Management



Allow:



Add Product



Edit Product



Delete Product





Each product contains:



Name



Category



Barcode



Cost Price



Selling Price



Current Stock



Minimum Stock



Product Image (optional)





Support searching and filtering.





---



Inventory



Features:



Stock In



Stock Out



Stock Adjustment



Low Stock Alert





Inventory must automatically update after every sale.





---



POS



Fast cashier screen.



Features:



Search Product



Add to Cart



Change Quantity



Discount



Remove Product



Complete Sale





Payment Methods:



Cash



Mobile Money (record only)



Bank Transfer (record only)





After payment:



Generate Receipt



Print Receipt



Save Transaction







---



Customers



Allow:



Add Customer



Edit Customer



Delete Customer





Customer Profile:



Name



Phone



Address





Display purchase history.





---



Expenses



Allow:



Add Expense



Edit Expense



Delete Expense





Expense Categories:



Rent



Salaries



Electricity



Transport



Others







---



Employees



Version 1 supports only:



Owner



Full access.



Cashier



Can:



Sell



View Products





Cannot:



View Reports



Change Settings



Delete Products





Owner can:



Create Cashiers



Disable Cashiers







---



Reports



Generate:



Sales Reports



Daily



Weekly



Monthly





Inventory Reports



Current Stock



Low Stock





Financial Reports



Revenue



Expenses



Profit





Export:



PDF







---



Alpha AI



Include Alpha AI inside the application.



Alpha AI must understand all business data stored inside ZPOS.



Users can ask:



How much did I sell today?



Show today's revenue.



Which products have low stock?



Which products sold the most?



Show my expenses.



Explain how to use this feature.



Help me understand this report.





Alpha AI should answer naturally in English and Kiswahili.



Display Alpha AI as a floating chat button available on every screen.





---



Settings



Allow editing:



Business Name



Business Logo



Phone Number



Address



Receipt Footer



Currency





---



Security



Implement:



Secure Authentication



Password Encryption



Session Management



Role Permissions



Organization Data Isolation







---



Offline-First Requirements



The application must continue working completely without internet.



While offline users must still be able to:



Login using a previously authenticated account



Open the app



Search products



Add products



Edit products



Create sales



Print receipts



Add customers



Record expenses



Manage inventory



View reports



Use Alpha AI with locally available business data





Business operations must never stop because of internet loss.





---



Local Database



Use a local database as the application's primary working database.



Store locally:



Products



Inventory



Sales



Customers



Expenses



Employees



Settings





The application should always read and write to the local database first.





---



Cloud Synchronization



When internet becomes available:



Automatically synchronize:



Products



Inventory



Sales



Customers



Expenses





Synchronization must happen silently in the background.



If synchronization fails:



Retry automatically.



Never lose business data.





---



Connectivity Indicator



Display current connection status.



Examples:



🟢 Online



🟡 Syncing...



🔴 Offline



When offline display:



Offline Mode — Your data is safely stored on this device and will automatically synchronize when an internet connection becomes available.





---



Capacitor Compatibility



The application must be fully compatible with Capacitor.



Support:



Android App



Responsive Layout



SQLite Local Database



Background Synchronization



Native Printing



Camera Access (future barcode scanning)



File Storage



Push Notification Ready







---



User Interface



Theme:



Premium Black & Gold



Design Style:



Modern



Minimal



Premium



Elegant



Fast



Professional





Use:



Rounded cards



Beautiful dashboard



Clean typography



Smooth animations



Professional icons



Responsive layouts







---



Navigation Menu



Dashboard



Sales



Products



Inventory



Customers



Expenses



Reports



Employees



Alpha AI



Settings



Logout





---



Technology Stack



The application should be built with:



React + Vite



TypeScript



Capacitor



SQLite (for offline local storage)



Supabase (cloud backend)



REST API



Responsive Design



Production-ready architecture







---



Final Goal



Build ZPOS  as a complete, production-ready, offline-first SaaS application that businesses can start using immediately and ready for deployment im vercel even through it will also live in lovable



The application should feel like commercial software, not a demo or template.



It must be fast, reliable, secure, mobile-ready, offline-capable,vercel deployment ready and branded as a premium product developed by Zetiora AI Technologies.   Use the pos image as the background in login page and use the other image for reference of button cuts exactly as its shown in images and fonts seen in image are what should be used

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://zpos-swift-sync.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/937bb494-4f4e-4dfe-b280-c20749ccfeab).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
