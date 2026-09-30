// ============================================================================
// KaamSaathi Natural Language & AI Support Engine (nlp.js)
// Natural language semantic search, compound task bundler,
// Customer Support Chatbot, Partner Support Chatbot, and Dialogue Resolver.
// ============================================================================

(function(root) {
  'use strict';

  // Semantic intent mapping for natural language search in Varanasi
  const INTENT_RULES = [
    // Electrical & Fans
    {
      keywords: ['fan', 'pankha', 'ceiling fan', 'spark', 'current', 'wiring', 'mcb', 'switch', 'socket', 'fuse', 'light', 'tubelight', 'bulb', 'choke', 'short circuit', 'bijli', 'power cut', 'inverter'],
      serviceName: 'Electrician',
      reason: 'Electrical repair & wiring specialist'
    },
    // Cooler & AC
    {
      keywords: ['cooler', 'cooler repair', 'cooler service', 'ghas', 'grass pad', 'cooler pump', 'cooler motor', 'cooler not cooling', 'cooler awaz', 'cooler noise'],
      serviceName: 'Cooler Repair & Service',
      reason: 'Cooler servicing, motor & pump repair'
    },
    {
      keywords: ['ac', 'air conditioner', 'ac repair', 'gas refill', 'ac cooling', 'ac service', 'ac filter', 'split ac', 'window ac', 'compressor'],
      serviceName: 'AC Repair & Service',
      reason: 'AC repair, gas charging & deep filter cleaning'
    },
    // Plumbing
    {
      keywords: ['plumber', 'pipe', 'leak', 'leakage', 'tap', 'nal', 'nal kharab', 'flush', 'tank', 'drain', 'drainage', 'sink', 'basin', 'geyser leak', 'bathroom fitting', 'water pipe', 'motor water', 'tullu'],
      serviceName: 'Plumber',
      reason: 'Plumbing, leaks & pipeline repair'
    },
    // Cleaning
    {
      keywords: ['clean', 'cleaning', 'safai', 'room clean', 'house clean', 'deep clean', 'dusting', 'mop', 'pocha', 'jhadu', 'ghar safai', 'move in clean', 'diwali clean'],
      serviceName: 'Home Cleaning',
      reason: 'Full home & room deep sanitization'
    },
    {
      keywords: ['bathroom clean', 'toilet clean', 'tiles stain', 'scaling', 'acid wash', 'bathroom yellow', 'commode'],
      serviceName: 'Bathroom Cleaning',
      reason: 'Bathroom tile de-scaling & sanitization'
    },
    {
      keywords: ['tank clean', 'water tank', 'tanki safai', 'overhead tank', 'tank sludge', 'water tank clean'],
      serviceName: 'Water Tank Cleaning',
      reason: 'Overhead water tank drain & UV scrub'
    },
    // Ironing & Laundry
    {
      keywords: ['iron', 'ironing', 'press', 'kapde press', 'steam press', 'shirt iron', 'pant press', 'kurta press'],
      serviceName: 'Ironing',
      reason: 'Crisp doorstep steam & heavy iron press'
    },
    {
      keywords: ['laundry', 'wash', 'cloth wash', 'kapde dhona', 'washing', 'dry clean', 'blanket wash'],
      serviceName: 'Laundry Pickup & Delivery',
      reason: 'Doorstep laundry wash & fold bundle'
    },
    // Cook & Food
    {
      keywords: ['cook', 'khana', 'rasoi', 'cooking', 'chef', 'tiffin', 'dinner', 'lunch', 'breakfast', 'roti', 'sabzi', 'dal chawal', 'homely cook'],
      serviceName: 'Home Cook',
      reason: 'Homely meals cooked fresh at your stove'
    },
    // Shifting & Moving
    {
      keywords: ['shift', 'shifting', 'move', 'relocation', 'ghar shift', 'room shift', 'luggage', 'boxes', 'furniture move', 'tempo', 'loading'],
      serviceName: 'House Shifting',
      reason: 'Complete room & flat shifting support'
    },
    {
      keywords: ['assemble', 'assembly', 'table assemble', 'bed assemble', 'wardrobe', 'ikea', 'drill', 'curtain', 'shelf', 'wall mount', 'tv mount'],
      serviceName: 'Furniture Assembly',
      reason: 'Furniture assembly & wall mounting'
    },
    // Tech Repair
    {
      keywords: ['laptop', 'computer', 'pc', 'windows', 'format', 'slow laptop', 'ssd', 'screen', 'laptop repair', 'virus'],
      serviceName: 'Computer/Laptop Repair',
      reason: 'Laptop diagnostics, SSD upgrade & OS service'
    },
    {
      keywords: ['helper', 'all rounder', 'help', 'maid', 'labor', 'mazdoor', 'errand', 'market help', 'general help'],
      serviceName: 'Book a Helper',
      reason: 'All-rounder helper for custom multi-task jobs'
    }
  ];

  class KaamSaathiNLP {
    // 1. Match Search Input
    matchService(inputText) {
      if (!inputText) return { service: { name: 'Book a Helper', base_price: 149, icon: '✦', color: '#f3e5f1', category: 'PERSONAL & OTHER' }, reason: 'Everyday domestic assistance' };
      const lower = inputText.toLowerCase();

      for (const rule of INTENT_RULES) {
        for (const kw of rule.keywords) {
          if (lower.includes(kw)) {
            return {
              service: {
                name: rule.serviceName,
                base_price: rule.serviceName === 'House Shifting' ? 999 : (rule.serviceName === 'Home Cleaning' ? 499 : 149),
                icon: rule.serviceName === 'Electrician' ? '⚡' : (rule.serviceName.includes('Cooler') ? '♨' : (rule.serviceName.includes('Cleaning') ? '☷' : '✦')),
                color: '#fff1cf',
                category: 'POPULAR'
              },
              reason: rule.reason
            };
          }
        }
      }

      return {
        service: { name: 'Book a Helper', base_price: 149, icon: '✦', color: '#f3e5f1', category: 'PERSONAL & OTHER' },
        reason: 'Matched all-rounder assistance'
      };
    }

    // 2. Multi-Task Compound Bundler ("Book a Helper")
    analyzeCompoundRequest(text) {
      if (!text) return { detectedServices: ['Book a Helper'], packagePrice: 199, summary: 'General helper assistance' };
      const lower = text.toLowerCase();
      const detected = [];

      if (lower.includes('clean') || lower.includes('safai') || lower.includes('dusting')) detected.push('Home Cleaning');
      if (lower.includes('shift') || lower.includes('box') || lower.includes('luggage') || lower.includes('carry') || lower.includes('move')) detected.push('House Shifting');
      if (lower.includes('assemble') || lower.includes('table') || lower.includes('bed') || lower.includes('furniture')) detected.push('Furniture Assembly');
      if (lower.includes('iron') || lower.includes('press') || lower.includes('shirt')) detected.push('Ironing');
      if (lower.includes('fan') || lower.includes('switch') || lower.includes('wire') || lower.includes('light')) detected.push('Electrician');
      if (lower.includes('cooler') || lower.includes('pump')) detected.push('Cooler Repair & Service');
      if (lower.includes('cook') || lower.includes('khana') || lower.includes('dinner')) detected.push('Home Cook');

      if (detected.length === 0) detected.push('Book a Helper');

      const count = detected.length;
      const baseEstimate = count === 1 ? 199 : (count === 2 ? 499 : (count === 3 ? 799 : 1099));

      return {
        detectedServices: detected,
        packagePrice: baseEstimate,
        summary: count > 1 ? `Detected ${count} combined tasks. Available as a discounted single helper bundle.` : `Detected 1 specialized task.`
      };
    }

    // 3. Customer Support Conversational AI
    processCustomerSupportDialogue(history, text, activeBookings = []) {
      const lower = text.toLowerCase();
      let reply = "";
      let actions = [];

      if (lower.includes('where is my booking') || lower.includes('status') || lower.includes('track') || lower.includes('my booking')) {
        if (activeBookings.length > 0) {
          const b = activeBookings[0];
          reply = `I checked your live records. Your latest booking **${b.booking_reference}** for **${b.service_name}** is currently in **${b.status.replace('_', ' ')}** status. Partner: **${b.partner_name || 'Assigned pro'}**.`;
          actions.push({ label: 'Open My Bookings', view: 'cust-bookings' });
        } else {
          reply = `You do not have any active bookings in progress right now. Would you like to book a verified professional today?`;
          actions.push({ label: 'Book a Service', view: 'cust-services' });
        }
      } else if (lower.includes('cancel') || lower.includes('how to cancel') || lower.includes('cancellation')) {
        reply = `To cancel a booking: Open **My Bookings**, select the pending order, and click **Dispute / Cancel**. Cancellations before partner arrival are 100% free of penalty.`;
        actions.push({ label: 'Go to My Bookings', view: 'cust-bookings' });
      } else if (lower.includes('refund') || lower.includes('money') || lower.includes('return')) {
        reply = `Refunds for cancelled or disputed bookings are processed automatically back to your original payment method (UPI / Card) within 2 to 4 business hours.`;
        actions.push({ label: 'Check Payments', view: 'cust-payments' });
      } else if (lower.includes('complain') || lower.includes('dispute') || lower.includes('bad service') || lower.includes('issue') || lower.includes('problem')) {
        reply = `We take service quality very seriously. You can raise a formal dispute and our admin mediation desk will step in immediately.`;
        actions.push({ label: 'Raise Support Request', triggerModal: '#create-ticket-modal' });
      } else if (lower.includes('address') || lower.includes('change address') || lower.includes('location')) {
        reply = `You can manage and save multiple addresses (Home, Work, Hostel) in your account so verified pros in Varanasi can find you with 1 click.`;
        actions.push({ label: 'Manage Saved Addresses', view: 'cust-addresses' });
      } else if (lower.includes('payment') || lower.includes('upi') || lower.includes('cash') || lower.includes('card')) {
        reply = `KaamSaathi supports UPI (GPay, PhonePe, Paytm), Cards, and Cash After Work. We do not charge hidden surge fees.`;
        actions.push({ label: 'View Payment History', view: 'cust-payments' });
      } else if (lower.includes('partner') || lower.includes('become a partner') || lower.includes('join as pro')) {
        reply = `To become a KaamSaathi service partner: Register an account, choose **"I want to provide services"**, complete the 6-step onboarding wizard, and submit your trade skills for admin verification.`;
      } else {
        reply = `Namaste! I am your KaamSaathi AI Assistant. I can help you with tracking bookings, payments, cancellation policies, address management, or submitting formal support requests. What can I do for you?`;
        actions.push({ label: 'Book a Service', view: 'cust-services' });
        actions.push({ label: 'Raise Support Ticket', triggerModal: '#create-ticket-modal' });
      }

      return { reply, actions };
    }

    // 4. Partner Support Conversational AI
    processPartnerSupportDialogue(history, text) {
      const lower = text.toLowerCase();
      let reply = "";
      let actions = [];

      if (lower.includes('accept') || lower.includes('how to accept') || lower.includes('booking request')) {
        reply = `When a customer books in your locality, a card appears under **Incoming Requests**. Click **Accept ✓** to claim the job and notify the customer immediately.`;
        actions.push({ label: 'View Incoming Requests', view: 'part-overview' });
      } else if (lower.includes('not receiving') || lower.includes('no requests') || lower.includes('why no jobs')) {
        reply = `Make sure: 1) Your profile has been audited and approved as **VERIFIED** by the Super Admin; 2) Your **Online Toggle** in the top bar is switched to **Online**; 3) Your service locality is set correctly.`;
        actions.push({ label: 'Check Verification Status', view: 'part-overview' });
      } else if (lower.includes('earnings') || lower.includes('payout') || lower.includes('payment') || lower.includes('bank')) {
        reply = `Your earnings are calculated automatically upon marking jobs **COMPLETED**. Payouts are transferred weekly directly to your registered account with zero middlemen cuts.`;
        actions.push({ label: 'Check Earnings', view: 'part-overview' });
      } else if (lower.includes('verify') || lower.includes('kyc') || lower.includes('verification')) {
        reply = `Our admin desk audits your masked government ID and Varanasi locality within 2 to 4 hours of onboarding. Once approved, you become eligible to accept customer bookings.`;
      } else if (lower.includes('area') || lower.includes('radius') || lower.includes('locality')) {
        reply = `You can adjust your service radius (1 km, 3 km, 5 km, 10 km) and primary locality anytime from your Partner Profile.`;
      } else {
        reply = `Namaste Partner! I can assist you with job requests, milestone status progression, weekly earnings calculations, availability toggling, and verification audits.`;
        actions.push({ label: 'View Incoming Jobs', view: 'part-overview' });
      }

      return { reply, actions };
    }

    // 5. Landing Page Assistant Dialogue
    processAssistantDialogue(history, text) {
      const match = this.matchService(text);
      const compound = this.analyzeCompoundRequest(text);

      if (compound.detectedServices.length > 1) {
        return {
          reply: `I analyzed your request and detected **${compound.detectedServices.length} tasks**: ${compound.detectedServices.join(', ')}. We can bundle these into a single verified all-rounder helper package starting at **₹${compound.packagePrice}**.`,
          actions: [
            { label: `Book Multi-Task Helper (₹${compound.packagePrice})`, serviceName: 'Book a Helper' },
            { label: `Book ${compound.detectedServices[0]} Only`, serviceName: compound.detectedServices[0] }
          ]
        };
      }

      return {
        reply: `Based on your description, I recommend **${match.service.name}** (${match.reason}). Verified professionals in Varanasi start from **₹${match.service.base_price}**.`,
        actions: [
          { label: `Book ${match.service.name} Now →`, serviceName: match.service.name }
        ]
      };
    }
  }

  root.NLP = new KaamSaathiNLP();

})(typeof window !== 'undefined' ? window : this);
