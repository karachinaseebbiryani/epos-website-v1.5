/**
 * Editable policy / info-page copy. Single source of truth so the operator
 * (or the main agent on a later round) can update wording without touching
 * the renderer. Each entry has:
 *   - title       : H1 + browser tab
 *   - description : meta description for SEO
 *   - sections    : array of { heading, body }. body supports plain text with
 *                   newlines preserved; embedded URLs auto-link via the renderer.
 *
 * Keep the tone friendly + concrete; vague legalese hurts SEO and customer
 * trust. These pages exist mainly so Google + AI assistants have something
 * authoritative to cite when a customer asks "what is your refund policy?"
 */

export const POLICY_PAGES = {
    privacy: {
        slug: "privacy",
        title: "Privacy Policy",
        description: "How Karachi Naseeb Biryani collects, uses and protects your personal data when you order online or sign up for Diamonds rewards.",
        updated: "June 2026",
        sections: [
            { heading: "What we collect",
              body: "When you order or sign up we store your name, phone number, delivery address, email and order history. We never collect or store full card numbers — card payments are handled by our payment processor and only a transaction reference is kept on file." },
            { heading: "Why we use it",
              body: "Your contact details are used to deliver your order, send delivery status updates over WhatsApp and email, run loyalty rewards (Diamonds), and let you re-order quickly. We do not sell personal data to third parties." },
            { heading: "How long we keep it",
              body: "Order records are kept for 24 months for accounting + dispute resolution, after which they are anonymised. You can request deletion of your account and personal data at any time by emailing us — your past orders will be retained without your name/phone attached." },
            { heading: "Cookies & analytics",
              body: "We use a single Google Analytics cookie to understand which menu items are popular and to fix broken pages. No personal identifiers are sent to Google. You can opt out by enabling 'Do Not Track' in your browser." },
            { heading: "Your rights",
              body: "You can: view your stored data (visit /profile), export your order history, correct anything inaccurate, or delete your account. To exercise any of these rights, email karachinaseebbiryani599@gmail.com and we'll respond within 7 days." },
            { heading: "Contact",
              body: "Questions about this policy? Email karachinaseebbiryani599@gmail.com or call +92 300 4928411." },
        ],
    },
    terms: {
        slug: "terms",
        title: "Terms & Conditions",
        description: "The rules of using Karachi Naseeb Biryani's online ordering, Diamonds rewards and event booking services.",
        updated: "August 2026",
        sections: [
            { heading: "Agreement to Terms",
              body: "By accessing and using www.karachinaseebbiryani.com or our mobile application to order biryani, Murg Pulao, BBQ and Pakistani food for delivery or pickup in Lahore, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our online ordering service. These terms apply to all orders placed through our website or mobile app for delivery across Lahore including Johar Town, Model Town, DHA, Township, Garden Town, Punjab Small Industry and surrounding areas." },
            { heading: "Placing an order",
              body: "An order is confirmed only after the restaurant accepts it (you'll get a WhatsApp / push notification within ~2 minutes). Until accepted, you can cancel free of charge from the tracking page. Once preparation has started, we cannot offer a refund. When you place an order, you authorize us to charge your selected payment method for the order total including food, delivery fees, and any applicable taxes. You are responsible for providing accurate delivery information including address, contact number, and any special instructions." },
            { heading: "Prices & payment",
              body: "All prices are in Pakistani Rupees (Rs) and include applicable taxes unless otherwise stated. The final total shown at checkout is what you pay — we recompute prices server-side, so any client-side display glitch will not affect what is charged. We accept Cash on Delivery, online card payments, bank transfers (Easypaisa, JazzCash, IBAN), and wallet credit. Prices are subject to change without notice, but any price increases will not affect orders already placed and confirmed. Special offers, discounts, and coupon codes are subject to their own terms and expiry dates as shown on our offers page." },
            { heading: "Delivery",
              body: "Delivery is offered within a 7 km radius of 68 Chatri Chowk, Punjab Small Industry, D Block, Lahore. Estimated delivery time is 30–45 minutes from acceptance. See /delivery for the full delivery policy. Delivery times are estimates and may vary based on order volume, traffic conditions, and weather. We will make every reasonable effort to deliver within the estimated time but are not liable for delays beyond our control. If you are not available at the delivery address after three contact attempts, the order may be returned and a re-delivery fee charged." },
            { heading: "Cancellations & refunds",
              body: "You can cancel free of charge within 2 minutes of placing the order. After that, if your order has not been prepared yet, call +92 300 4928411 and we'll do our best. Once preparation has started, the order is non-refundable. Quality issues are handled case-by-case — contact us within 24 hours of delivery. For complete details on refund timelines, payment method refunds, and non-refundable situations, please see our Refund Policy page." },
            { heading: "Diamonds rewards program",
              body: "Diamonds are earned on successful deliveries only — cancelled or rejected orders earn nothing. Diamonds have no cash value and cannot be transferred between accounts. We reserve the right to suspend rewards on accounts found to be abusing promotions. You must create an account and be signed in to earn and redeem Diamonds. Diamond earn rates and reward catalog items are subject to change at our discretion. Your Diamonds balance does not expire as long as your account remains active, but we reserve the right to deactivate accounts inactive for more than 24 months." },
            { heading: "User accounts and conduct",
              body: "You are responsible for maintaining the confidentiality of your account credentials. Please do not place fraudulent orders, abuse coupons / Diamonds, harass our delivery team, or attempt to disrupt our service. We reserve the right to suspend accounts that breach these rules. You agree to provide accurate information when creating an account and keep it updated. We reserve the right to refuse service to anyone for any reason at any time." },
            { heading: "Food allergy and dietary information",
              body: "While we make reasonable efforts to accommodate dietary restrictions noted in order instructions, our kitchen handles common allergens including gluten, dairy, nuts, and shellfish. Cross-contamination may occur. If you have severe allergies, please call us at +92 300 4928411 before ordering to discuss your specific needs. We cannot guarantee allergen-free preparation." },
            { heading: "Intellectual property",
              body: "All content on this website including text, images, logos, menus, and software is the property of Karachi Naseeb Biryani or its content suppliers and is protected by Pakistani and international copyright laws. You may not reproduce, distribute, or create derivative works without our written permission." },
            { heading: "Limitation of liability",
              body: "To the maximum extent permitted by Pakistani law, Karachi Naseeb Biryani shall not be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of our service. Our total liability shall not exceed the amount you paid for the specific order in question." },
            { heading: "Changes to terms",
              body: "We may update these terms occasionally. Continued use of the site after an update implies acceptance. Material changes will be highlighted on this page with a revised 'Updated' date above. We recommend reviewing these terms periodically when using our service." },
            { heading: "Governing Law and dispute resolution",
              body: "These Terms and Conditions are governed by the laws of the Islamic Republic of Pakistan. You agree that the courts of Lahore (including any consumer court) will have exclusive jurisdiction in any dispute you have with us. Any disputes will first be attempted to be resolved through good faith negotiation before pursuing legal action." },
            { heading: "Contact information",
              body: "Questions about these terms? Contact us at: Phone/WhatsApp: +92 300 4928411, Email: karachinaseebbiryani599@gmail.com, Address: 68 Chatri Chowk, Punjab Small Industry, D Block, Lahore, Punjab, Pakistan. See our Contact page for additional ways to reach us." },
        ],
    },
    delivery: {
        slug: "delivery",
        title: "Delivery Information",
        description: "Delivery area, timings, fees and what to expect when you order from Karachi Naseeb Biryani in Lahore.",
        updated: "June 2026",
        sections: [
            { heading: "Where we deliver",
              body: "We deliver across Lahore within a 7 km radius of 68 Chatri Chowk, Punjab Small Industry, D Block. The checkout page will tell you instantly whether your address is in range — we use your map pin to measure, so an exact location helps." },
            { heading: "How long it takes",
              body: "Most orders arrive 30–45 minutes after the restaurant accepts. Pending acceptance is usually under 2 minutes during business hours. You'll see a live status timeline + push notifications at every step (accepted → preparing → out for delivery → delivered)." },
            { heading: "Delivery charges",
              body: "Delivery fees scale by distance. The exact fee is shown on the checkout page before you pay. Orders above a certain subtotal qualify for free delivery — current threshold is shown on the cart and offers page." },
            { heading: "Tracking your order",
              body: "Every order comes with a tracking link sent via WhatsApp. Tap it to see the live status. You can also enable push notifications on first order so your phone buzzes when the rider is on the way." },
            { heading: "Address & access",
              body: "Please share an accurate map pin and apartment / floor number, especially for buildings. Our riders will call if they can't find you. If nobody answers after 3 attempts, the order is returned and a re-delivery fee may apply." },
            { heading: "Payment options",
              body: "Cash on Delivery, bank transfer (Easypaisa / JazzCash / IBAN), and card payment are all supported. COD orders must be paid on receipt — please have exact change ready if possible." },
        ],
    },
    refunds: {
        slug: "refunds",
        title: "Return & Refund Policy",
        description: "When and how Karachi Naseeb Biryani refunds an online order: cancellation windows, quality issues, failed payments and refund timelines.",
        updated: "July 2026",
        sections: [
            { heading: "Our commitment to customer satisfaction",
              body: "At Karachi Naseeb Biryani, we take pride in delivering fresh, authentic Karachi-style biryani, Murg Pulao and Pakistani cuisine across Lahore. If something goes wrong with your order, we're here to make it right. This refund policy explains when and how we issue refunds for online orders placed through our website or mobile app for delivery or pickup in Johar Town, Model Town, DHA, Township, Garden Town, Punjab Small Industry and surrounding areas." },
            { heading: "Free cancellation window",
              body: "You can cancel any order free of charge within 2 minutes of placing it — straight from the order tracking page. Orders cancelled in this window are never charged; any online payment already made is refunded in full. This gives you time to change your mind or correct any mistakes in your order immediately after checkout without any penalty or questions asked." },
            { heading: "After the restaurant accepts",
              body: "If preparation has not started yet, call +92 300 4928411 and we'll do our best to cancel with a full refund. Once food preparation has started, the order can no longer be cancelled or refunded — every dish is cooked fresh to order. You'll receive notifications via WhatsApp and in-app when your order is accepted and when preparation begins, so you'll know the status at each stage." },
            { heading: "Food quality or wrong items",
              body: "If something arrives wrong, missing or below standard, contact us within 24 hours of delivery (phone or email, with a photo if possible). Depending on the issue we will replace the item, credit your account, or refund the affected amount — handled case-by-case, usually within 1 business day. Quality is our top priority and we take all complaints seriously. Common issues we resolve include missing items, incorrect orders, cold food, spillage, or food that doesn't meet our quality standards." },
            { heading: "Failed or duplicate online payments",
              body: "If money left your account (card / Easypaisa / JazzCash / bank) but the order shows unpaid or failed, don't pay again — send us the transaction reference. Verified duplicate or failed-capture amounts are refunded to the original payment method. Payment processing issues are rare but when they occur we resolve them quickly. Please email us your transaction screenshot or reference number so we can investigate with our payment processor." },
            { heading: "Refund methods and timelines",
              body: "Approved refunds are issued to the original payment method: wallet (Easypaisa / JazzCash) refunds typically arrive within 3–5 business days, card refunds within 5–10 business days depending on your bank. Cash-on-delivery issues are settled by account credit or a bank transfer to you. For account credits (store credit), the amount is added to your wallet balance immediately and can be used on your next order. Refund timelines depend on your bank or payment provider's processing speed, not on us, so please allow the full timeframe before following up." },
            { heading: "Non-refundable situations",
              body: "We cannot refund: orders where preparation has started (except quality issues), orders returned because nobody was reachable at the delivery address after 3 attempts, or discounts/Diamonds used on a cancelled order (Diamonds are re-credited only if we cancel). Change of mind after food preparation has begun is not eligible for refund. Please ensure your delivery address and contact number are accurate when placing your order to avoid delivery issues." },
            { heading: "Delivery address issues",
              body: "If our delivery rider cannot reach you after three contact attempts at the address provided, the order will be returned to our location. In such cases, you may arrange to collect the order yourself from 68 Chatri Chowk, Punjab Small Industry, D Block, Lahore, or request re-delivery (re-delivery fee applies). No refund is issued for orders where the customer was unreachable or provided an incorrect address." },
            { heading: "How to request a refund",
              body: "To request a refund, contact us as soon as possible with your order number and details of the issue. Refund questions: call +92 300 4928411 or email karachinaseebbiryani599@gmail.com. Office: 68 Chatri Chowk, Punjab Small Industry, D Block, Lahore. We respond within 1 business day. For the fastest resolution, have your order number ready and provide photos if reporting a quality issue. We process most refund requests within 24-48 hours of receiving your complaint." },
        ],
    },
    ownership: {
        slug: "ownership",
        title: "Ownership Statement",
        description: "Who owns and operates karachinaseebbiryani.com — legal identity, physical address and contact details of Karachi Naseeb Biryani and Murg Pulao, Lahore.",
        updated: "July 2026",
        sections: [
            { heading: "About our restaurant",
              body: "Karachi Naseeb Biryani and Murg Pulao is a family-owned and operated restaurant specializing in authentic Karachi-style biryani, traditional Murg Pulao, BBQ, Karahi and Pakistani cuisine. We've been serving the Lahore community with fresh, high-quality food prepared using traditional recipes and premium ingredients. Our commitment is to bring the authentic taste of Karachi biryani to Lahore with every order, whether for delivery or pickup." },
            { heading: "Website and app ownership",
              body: "This website, www.karachinaseebbiryani.com, and the Karachi Naseeb mobile application are owned and operated by Karachi Naseeb Biryani and Murg Pulao, a restaurant business based in Lahore, Pakistan. All orders placed through this website or app are fulfilled directly by us — no third party sells through this site. We maintain full control over menu, pricing, food preparation, and delivery operations to ensure consistent quality and service standards." },
            { heading: "Business details and location",
              body: "Business name: Karachi Naseeb Biryani and Murg Pulao. Physical address: 68 Chatri Chowk, Punjab Small Industry, D Block, Lahore, Punjab, Pakistan. All food is prepared at and delivered from this location. Our kitchen operates daily with fresh ingredients sourced from trusted local suppliers. We deliver across Lahore including Johar Town, Model Town, DHA, Township, Garden Town and surrounding areas within a 7 km radius of our location." },
            { heading: "Contact information",
              body: "Phone / WhatsApp: +92 300 4928411. Email: karachinaseebbiryani599@gmail.com. We respond to enquiries within 1 business day. Our customer service team is available during business hours to assist with orders, catering enquiries, feedback, and any questions about our menu or services. Visit our Contact page for additional ways to reach us including our location map and business hours." },
            { heading: "Online payments and security",
              body: "Online payments on this website are processed by our licensed payment partners (including SafePay). Charges on your statement will reference the payment processor and/or Karachi Naseeb. All prices are in Pakistani Rupees (PKR). We use industry-standard encryption and secure payment gateways to protect your financial information. We never store full credit card numbers on our servers — all card payments are processed through PCI-compliant payment processors." },
            { heading: "Our values and quality commitment",
              body: "We are committed to serving authentic Pakistani cuisine prepared fresh to order using quality halal meat, premium basmati rice, and traditional spices. Our team takes pride in maintaining high food safety standards, ensuring timely delivery, and providing excellent customer service. We value customer feedback and continuously work to improve our food, service, and online ordering experience. Every order is prepared with care as if we're cooking for our own family." },
            { heading: "Transparency and accountability",
              body: "This ownership statement is provided for transparency and to comply with Pakistani business regulations. As a local restaurant serving the Lahore community, we believe in being open about who we are, where we're located, and how customers can reach us. We take full responsibility for all orders, deliveries, and customer interactions conducted through our website and mobile app." },
        ],
    },
    "rewards-program": {
        slug: "rewards-program",
        title: "Rewards Program — Diamonds",
        description: "How Diamonds work at Karachi Naseeb Biryani: earn on every delivered order, redeem for discounts and free items.",
        updated: "June 2026",
        sections: [
            { heading: "How you earn",
              body: "You earn Diamonds automatically on every order that is successfully delivered. The default rate is 10 Diamonds per Rs 100 spent, but watch the offers page for periodic 2x and 3x Diamond weekends." },
            { heading: "How you redeem",
              body: "Go to /rewards to see the catalogue. Diamonds can be exchanged for: percentage discounts on a future order, fixed Rs-off coupons, or specific free menu items (e.g. a free dessert). Redemption happens at checkout — pick your reward, finish the order, and it's applied." },
            { heading: "Rules of the road",
              body: "Diamonds have no cash value and cannot be transferred between accounts. Cancelled or rejected orders earn no Diamonds. Discount rewards cannot be stacked with a coupon discount on the same order — but a free-item reward CAN stack with a coupon." },
            { heading: "Welcome bonus",
              body: "First-time customers get a one-time WELCOME2 coupon emailed after their first delivery. It's tied to your account, single-use, and expires in 30 days." },
            { heading: "Questions",
              body: "Drop us an email at karachinaseebbiryani599@gmail.com or call +92 300 4928411 — we love loyalty geeks." },
        ],
    },
};

export function getPolicy(slug) {
    return POLICY_PAGES[slug] || null;
}
