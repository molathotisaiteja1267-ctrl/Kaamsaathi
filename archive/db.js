// ============================================================================
// KaamSaathi Persistent Relational Database (db.js)
// Real persistent storage using localStorage with seeded data & relations
// ============================================================================

(function(root) {
  'use strict';

  const STORAGE_KEY = 'KAAMSAATHI_DB_V2';

  // Seed services catalog (50+ items across 8 categories)
  const SEED_SERVICES = [
    // 1. HOME MAINTENANCE
    { id: 'srv-1', name: 'Electrician', category: 'HOME MAINTENANCE', description: 'Fans, lights, short-circuits, switches & domestic electrical wiring', base_price: 149, icon: '⚡', color: '#fff1cf', active: true },
    { id: 'srv-2', name: 'Plumber', category: 'HOME MAINTENANCE', description: 'Leaks, taps, pipelines, bathroom fittings & drainage repair', base_price: 149, icon: '◌', color: '#dbf1f3', active: true },
    { id: 'srv-3', name: 'Carpenter', category: 'HOME MAINTENANCE', description: 'Door fixes, latch repairs, wooden fixtures & custom woodwork', base_price: 199, icon: '⚒', color: '#f7ecd2', active: true },
    { id: 'srv-4', name: 'Painter', category: 'HOME MAINTENANCE', description: 'Touch-ups, single room painting, waterproof coating & wall prep', base_price: 399, icon: '▩', color: '#e8e4fa', active: true },
    { id: 'srv-5', name: 'AC Repair & Service', category: 'HOME MAINTENANCE', description: 'Filter cleaning, gas refill, cooling check & compressor repair', base_price: 299, icon: '❄', color: '#dff5ed', active: true },
    { id: 'srv-6', name: 'Cooler Repair & Service', category: 'HOME MAINTENANCE', description: 'Grass pad replacement, motor fixing, pump repair & summer prep', base_price: 199, icon: '♨', color: '#e1f3ea', active: true },
    { id: 'srv-7', name: 'Refrigerator Repair', category: 'HOME MAINTENANCE', description: 'Cooling issues, thermostat, defrosting problems & coil fixes', base_price: 249, icon: '🧊', color: '#e0f2fe', active: true },
    { id: 'srv-8', name: 'Washing Machine Repair', category: 'HOME MAINTENANCE', description: 'Drainage blockage, drum spin issues, motor & vibration fixes', base_price: 249, icon: '🌀', color: '#f3e8ff', active: true },
    { id: 'srv-9', name: 'RO/Water Purifier Service', category: 'HOME MAINTENANCE', description: 'Candle replacement, membrane cleaning, TDS tuning & filter service', base_price: 199, icon: '💧', color: '#cffafe', active: true },
    { id: 'srv-10', name: 'Geyser Repair', category: 'HOME MAINTENANCE', description: 'Thermostat replacement, element change & water heating service', base_price: 229, icon: '🔥', color: '#ffedd5', active: true },
    { id: 'srv-11', name: 'Fan Installation & Repair', category: 'HOME MAINTENANCE', description: 'Ceiling, table and exhaust fan hanging, capacitor & winding check', base_price: 129, icon: '🌀', color: '#fffbeb', active: true },
    { id: 'srv-12', name: 'Switch & Socket Repair', category: 'HOME MAINTENANCE', description: 'Modular switch fixes, MCB replacement & board rewire', base_price: 99, icon: '🔌', color: '#fef3c7', active: true },
    { id: 'srv-13', name: 'CCTV Installation', category: 'HOME MAINTENANCE', description: 'Camera mounting, DVR wiring, phone sync & angle setup', base_price: 499, icon: '📹', color: '#f1f5f9', active: true },
    { id: 'srv-14', name: 'Wi-Fi/Router Setup', category: 'HOME MAINTENANCE', description: 'Router config, range extender setup & Ethernet crimping', base_price: 199, icon: '📶', color: '#e2e8f0', active: true },

    // 2. CLEANING
    { id: 'srv-15', name: 'Home Cleaning', category: 'CLEANING', description: 'Complete deep cleaning of living rooms, bedrooms and balconies', base_price: 499, icon: '☷', color: '#e1f3ea', active: true },
    { id: 'srv-16', name: 'Bathroom Cleaning', category: 'CLEANING', description: 'Tile de-scaling, sanitization, fittings shine & acid-free cleaning', base_price: 199, icon: '🚿', color: '#ccfbf1', active: true },
    { id: 'srv-17', name: 'Kitchen Cleaning', category: 'CLEANING', description: 'Oil stain removal, chimney surface degreasing & shelf cleaning', base_price: 299, icon: '🍳', color: '#fef9c3', active: true },
    { id: 'srv-18', name: 'Sofa Cleaning', category: 'CLEANING', description: 'Fabric shampooing, vacuuming & deep dirt extraction', base_price: 249, icon: '🛋️', color: '#ede9fe', active: true },
    { id: 'srv-19', name: 'Carpet Cleaning', category: 'CLEANING', description: 'Dry vacuum, wet foam extraction & pet hair removal', base_price: 199, icon: '🧶', color: '#fae8ff', active: true },
    { id: 'srv-20', name: 'Window Cleaning', category: 'CLEANING', description: 'Glass pane wipe-down, channel dusting & streak-free polish', base_price: 149, icon: '🪟', color: '#e0e7ff', active: true },
    { id: 'srv-21', name: 'Water Tank Cleaning', category: 'CLEANING', description: 'Overhead & underground tank sludge drain & UV/chlorine scrub', base_price: 499, icon: '🛢️', color: '#bae6fd', active: true },
    { id: 'srv-22', name: 'Terrace Cleaning', category: 'CLEANING', description: 'High-pressure wash, moss removal & drain outlet clearing', base_price: 349, icon: '🏙️', color: '#fed7aa', active: true },
    { id: 'srv-23', name: 'Pest Control', category: 'CLEANING', description: 'Cockroach gel treatment, termite shield & mosquito fogging', base_price: 399, icon: '🐜', color: '#fecaca', active: true },
    { id: 'srv-24', name: 'Post-Construction Cleaning', category: 'CLEANING', description: 'Paint scrape-off, cement dust removal & ready-to-move wash', base_price: 799, icon: '🏗️', color: '#fde68a', active: true },
    { id: 'srv-25', name: 'Move-in/Move-out Cleaning', category: 'CLEANING', description: 'Full property turnover deep clean with disinfectant', base_price: 599, icon: '📦', color: '#d9f99d', active: true },

    // 3. LAUNDRY & CLOTHING
    { id: 'srv-26', name: 'Clothes Washing', category: 'LAUNDRY & CLOTHING', description: 'Hand wash or machine wash with fabric softener', base_price: 99, icon: '🧺', color: '#e0e7ff', active: true },
    { id: 'srv-27', name: 'Ironing', category: 'LAUNDRY & CLOTHING', description: 'Crisp steam or heavy iron press, doorstep pickup/drop', base_price: 79, icon: '♨', color: '#e8e4fa', active: true },
    { id: 'srv-28', name: 'Dry Cleaning', category: 'LAUNDRY & CLOTHING', description: 'Suits, sherwanis, sarees & heavy blankets professional wash', base_price: 199, icon: '👔', color: '#fce7f3', active: true },
    { id: 'srv-29', name: 'Laundry Pickup & Delivery', category: 'LAUNDRY & CLOTHING', description: 'Complete wash & fold bundle with rapid return', base_price: 149, icon: '🛵', color: '#dcfce7', active: true },
    { id: 'srv-30', name: 'Shoe Cleaning', category: 'LAUNDRY & CLOTHING', description: 'Sneaker spa, leather conditioning & sole whitening', base_price: 129, icon: '👟', color: '#ffedd5', active: true },
    { id: 'srv-31', name: 'Bag Cleaning', category: 'LAUNDRY & CLOTHING', description: 'Backpack, handbag & travel suitcase stain removal', base_price: 129, icon: '🎒', color: '#fef08a', active: true },

    // 4. FOOD & KITCHEN
    { id: 'srv-32', name: 'Home Cook', category: 'FOOD & KITCHEN', description: 'Homely breakfast, lunch or dinner cooked fresh at your stove', base_price: 249, icon: '⌘', color: '#fde4de', active: true },
    { id: 'srv-33', name: 'Tiffin Service', category: 'FOOD & KITCHEN', description: 'Healthy student & office daily meal boxes delivery', base_price: 120, icon: '🍱', color: '#ffedd5', active: true },
    { id: 'srv-34', name: 'Party/Catering Helper', category: 'FOOD & KITCHEN', description: 'Food serving, buffet setup & guest hospitality helper', base_price: 349, icon: '🍲', color: '#fef3c7', active: true },
    { id: 'srv-35', name: 'Kitchen Assistance', category: 'FOOD & KITCHEN', description: 'Vegetable chopping, dough kneading & pantry organization', base_price: 149, icon: '🔪', color: '#fef9c3', active: true },
    { id: 'srv-36', name: 'Grocery Pickup', category: 'FOOD & KITCHEN', description: 'Mandi/supermarket fresh vegetables & essentials run', base_price: 79, icon: '🛒', color: '#dcfce7', active: true },
    { id: 'srv-37', name: 'Utensil Cleaning', category: 'FOOD & KITCHEN', description: 'Post-meal dishwashing & kitchen counter wipe-down', base_price: 99, icon: '🍽️', color: '#e0f2fe', active: true },

    // 5. MOVING & HOUSEHOLD HELP
    { id: 'srv-38', name: 'House Shifting', category: 'MOVING & HOUSEHOLD HELP', description: 'Complete room & apartment relocation with reliable team', base_price: 999, icon: '🚚', color: '#f7ecd2', active: true },
    { id: 'srv-39', name: 'Packing & Unpacking', category: 'MOVING & HOUSEHOLD HELP', description: 'Bubble wrap, carton sealing & careful unboxing support', base_price: 349, icon: '📦', color: '#fed7aa', active: true },
    { id: 'srv-40', name: 'Furniture Moving', category: 'MOVING & HOUSEHOLD HELP', description: 'Bed, sofa, wardrobe lifting across floors without damage', base_price: 299, icon: '🪑', color: '#fde68a', active: true },
    { id: 'srv-41', name: 'Furniture Assembly', category: 'MOVING & HOUSEHOLD HELP', description: 'IKEA/online tables, beds, study desks & wardrobe setup', base_price: 199, icon: '⚒', color: '#e2f0df', active: true },
    { id: 'srv-42', name: 'Curtain Installation', category: 'MOVING & HOUSEHOLD HELP', description: 'Rod drilling, ring hanging & window pleat alignment', base_price: 129, icon: '🪟', color: '#ede9fe', active: true },
    { id: 'srv-43', name: 'Wall Mounting', category: 'MOVING & HOUSEHOLD HELP', description: 'TV bracket mounting, heavy mirrors & photo frame arrays', base_price: 149, icon: '🖼️', color: '#fae8ff', active: true },
    { id: 'srv-44', name: 'Shelf Installation', category: 'MOVING & HOUSEHOLD HELP', description: 'Floating shelves, book racks & bathroom corner shelves', base_price: 129, icon: '🪜', color: '#fce7f3', active: true },
    { id: 'srv-45', name: 'Loading & Unloading', category: 'MOVING & HOUSEHOLD HELP', description: 'Heavy goods loading onto tempo / unloading with care', base_price: 249, icon: '🏋️', color: '#e0e7ff', active: true },
    { id: 'srv-46', name: 'Local Delivery', category: 'MOVING & HOUSEHOLD HELP', description: 'Point-to-point document, package & item bike delivery', base_price: 69, icon: '🛵', color: '#dcfce7', active: true },

    // 6. VEHICLE SERVICES
    { id: 'srv-47', name: 'Bike Washing', category: 'VEHICLE SERVICES', description: 'Foam wash, chain degrease & tire shine at your doorstep', base_price: 99, icon: '🏍️', color: '#dbeafe', active: true },
    { id: 'srv-48', name: 'Car Washing', category: 'VEHICLE SERVICES', description: 'Exterior high-pressure wash, interior vacuum & dashboard polish', base_price: 299, icon: '🚗', color: '#bfdbfe', active: true },
    { id: 'srv-49', name: 'Bike Servicing', category: 'VEHICLE SERVICES', description: 'Engine oil change, brake tune & general maintenance', base_price: 249, icon: '🔧', color: '#93c5fd', active: true },
    { id: 'srv-50', name: 'Car Servicing', category: 'VEHICLE SERVICES', description: 'Doorstep filter check, fluid top-up & multi-point inspection', base_price: 599, icon: '🚙', color: '#60a5fa', active: true },
    { id: 'srv-51', name: 'Puncture Repair', category: 'VEHICLE SERVICES', description: 'Tubeless & tube tire puncture fix on spot in emergency', base_price: 99, icon: '🛞', color: '#cbd5e1', active: true },
    { id: 'srv-52', name: 'Battery Jump Start', category: 'VEHICLE SERVICES', description: 'Dead vehicle battery jump start with portable booster', base_price: 149, icon: '🔋', color: '#fef08a', active: true },
    { id: 'srv-53', name: 'Vehicle Pickup/Drop', category: 'VEHICLE SERVICES', description: 'Safe vehicle transport to authorized service center', base_price: 149, icon: '🚚', color: '#e2e8f0', active: true },

    // 7. OUTDOOR SERVICES
    { id: 'srv-54', name: 'Gardening', category: 'OUTDOOR SERVICES', description: 'Pot soil turnover, weed removal & fertilizer addition', base_price: 199, icon: '🌱', color: '#dcfce7', active: true },
    { id: 'srv-55', name: 'Lawn Maintenance', category: 'OUTDOOR SERVICES', description: 'Grass trimming, edging, watering & debris cleanup', base_price: 299, icon: '🌿', color: '#bbf7d0', active: true },
    { id: 'srv-56', name: 'Plant Care', category: 'OUTDOOR SERVICES', description: 'Repotting, pest spray for indoor plants & nourishment', base_price: 149, icon: '🪴', color: '#86efac', active: true },
    { id: 'srv-57', name: 'Tree Trimming', category: 'OUTDOOR SERVICES', description: 'Overhanging branches cut back & safe green waste disposal', base_price: 349, icon: '🌳', color: '#4ade80', active: true },
    { id: 'srv-58', name: 'Balcony Cleaning', category: 'OUTDOOR SERVICES', description: 'Railing scrub, floor wash, bird net wipe & pot organization', base_price: 149, icon: '🪟', color: '#ccfbf1', active: true },
    { id: 'srv-59', name: 'Garbage Removal', category: 'OUTDOOR SERVICES', description: 'De-clutter haul-off, carton discards & garden waste transport', base_price: 149, icon: '🗑️', color: '#f3f4f6', active: true },

    // 8. PERSONAL & OTHER
    { id: 'srv-60', name: 'Pet Care', category: 'PERSONAL & OTHER', description: 'Pet feeding, grooming brushing & basic companionship', base_price: 149, icon: '🐾', color: '#ffedd5', active: true },
    { id: 'srv-61', name: 'Dog Walking', category: 'PERSONAL & OTHER', description: 'Morning / evening active 45-minute neighborhood walk', base_price: 99, icon: '🐕', color: '#fed7aa', active: true },
    { id: 'srv-62', name: 'Elderly Assistance', category: 'PERSONAL & OTHER', description: 'Hospital accompany, medicine reminder & gentle walking companion', base_price: 249, icon: '🤝', color: '#fde68a', active: true },
    { id: 'srv-63', name: 'Event Helpers', category: 'PERSONAL & OTHER', description: 'Birthday/pooja arrangements, chair placement & stage support', base_price: 299, icon: '🎉', color: '#fae8ff', active: true },
    { id: 'srv-64', name: 'Photographer', category: 'PERSONAL & OTHER', description: 'Family function, product or birthday candid photo shoot', base_price: 799, icon: '📷', color: '#f3e8ff', active: true },
    { id: 'srv-65', name: 'Delivery/Errand Services', category: 'PERSONAL & OTHER', description: 'Bill payments, courier drops, market errands done for you', base_price: 89, icon: '🏃', color: '#e0f2fe', active: true },
    { id: 'srv-66', name: 'Computer/Laptop Repair', category: 'PERSONAL & OTHER', description: 'OS install, slow performance fix, SSD upgrade & virus purge', base_price: 299, icon: '💻', color: '#dbeafe', active: true },
    { id: 'srv-67', name: 'Mobile Repair', category: 'PERSONAL & OTHER', description: 'Screen guard, charging port fix, battery replace & data transfer', base_price: 199, icon: '📱', color: '#bfdbfe', active: true },
    { id: 'srv-68', name: 'Appliance Installation', category: 'PERSONAL & OTHER', description: 'TV, microwave, washing machine unbox, hookup & demo', base_price: 199, icon: '🔌', color: '#fef08a', active: true },
    { id: 'srv-69', name: 'Book a Helper', category: 'PERSONAL & OTHER', description: 'General all-rounder helper for custom multi-task needs', base_price: 199, icon: '✦', color: '#f3e5f1', active: true }
  ];

  // Demo Password Hash for 'KaamSaathi@2026' with salt 'salt_ks'
  const DEMO_PASSWORD_HASH = '6a87b1c4e9768a3f890cf2c129e71ab87cb89116e04d49a37e8c187be0d1f4ae';

  const INITIAL_USERS = [
    {
      id: 'usr-cust-1',
      email: 'demo.customer@demo.kaamsaathi.test',
      phone: '+91 98765 43210',
      password_hash: DEMO_PASSWORD_HASH,
      role: 'CUSTOMER',
      email_verified: true,
      phone_verified: true,
      is_demo: true,
      created_at: '2026-08-01T10:00:00.000Z',
      updated_at: '2026-08-14T12:00:00.000Z'
    },
    {
      id: 'usr-part-1',
      email: 'demo.partner@demo.kaamsaathi.test',
      phone: '+91 98111 22334',
      password_hash: DEMO_PASSWORD_HASH,
      role: 'PARTNER',
      email_verified: true,
      phone_verified: true,
      is_demo: true,
      created_at: '2026-07-15T09:00:00.000Z',
      updated_at: '2026-08-14T11:00:00.000Z'
    },
    {
      id: 'usr-adm-1',
      email: 'demo.admin@demo.kaamsaathi.test',
      phone: '+91 99000 88776',
      password_hash: DEMO_PASSWORD_HASH,
      role: 'ADMIN',
      email_verified: true,
      phone_verified: true,
      is_demo: true,
      created_at: '2026-06-01T08:00:00.000Z',
      updated_at: '2026-08-14T08:00:00.000Z'
    }
  ];

  const INITIAL_CUSTOMERS = [
    {
      id: 'cust-1',
      user_id: 'usr-cust-1',
      full_name: 'Shreya Mishra',
      profile_photo: '',
      preferred_language: 'Hindi',
      created_at: '2026-08-01T10:00:00.000Z',
      updated_at: '2026-08-14T12:00:00.000Z'
    }
  ];

  const INITIAL_PARTNERS = [
    {
      id: 'part-1',
      user_id: 'usr-part-1',
      full_name: 'Rahul Kumar',
      initials: 'RK',
      profile_photo: '',
      date_of_birth: '1995-04-12',
      gender: 'Male',
      bio: 'Certified technician with 4+ years of residential electrical repair, appliance setup & furniture assembly experience.',
      experience_years: 4,
      service_area: 'Lanka, Varanasi',
      service_radius: '5 km',
      service_city: 'Varanasi',
      service_locality: 'Lanka',
      verification_status: 'VERIFIED',
      rating: 4.9,
      rating_count: 428,
      completed_jobs: 428,
      response_rate: '96%',
      on_time_rate: '94%',
      starting_price: 149,
      is_online: true,
      primary_skills: ['Electrician', 'Carpenter', 'Furniture Assembly', 'Cooler Repair & Service'],
      avatar_bg: 'linear-gradient(135deg,#1d4545,#c98965)',
      created_at: '2026-07-15T09:00:00.000Z'
    },
    {
      id: 'part-2',
      user_id: 'usr-part-2',
      full_name: 'Amit Sharma',
      initials: 'AS',
      profile_photo: '',
      date_of_birth: '1993-08-22',
      gender: 'Male',
      bio: 'Expert in residential deep cleaning, sofa extraction, water tank sanitization & shifting assistance.',
      experience_years: 5,
      service_area: 'Bhelupur, Varanasi',
      service_radius: '10 km',
      service_city: 'Varanasi',
      service_locality: 'Bhelupur',
      verification_status: 'VERIFIED',
      rating: 4.8,
      rating_count: 312,
      completed_jobs: 312,
      response_rate: '98%',
      on_time_rate: '96%',
      starting_price: 299,
      is_online: true,
      primary_skills: ['Home Cleaning', 'Bathroom Cleaning', 'House Shifting', 'Packing & Unpacking'],
      avatar_bg: 'linear-gradient(135deg,#285f59,#7db4a1)',
      created_at: '2026-07-20T11:00:00.000Z'
    },
    {
      id: 'part-3',
      user_id: 'usr-part-3',
      full_name: 'Priya Singh',
      initials: 'PS',
      profile_photo: '',
      date_of_birth: '1996-02-18',
      gender: 'Female',
      bio: 'Homely hygienic North Indian cook, tiffin service specialist & meal prep expert.',
      experience_years: 5,
      service_area: 'Sigra, Varanasi',
      service_radius: '5 km',
      service_city: 'Varanasi',
      service_locality: 'Sigra',
      verification_status: 'VERIFIED',
      rating: 4.9,
      rating_count: 186,
      completed_jobs: 186,
      response_rate: '95%',
      on_time_rate: '92%',
      starting_price: 249,
      is_online: true,
      primary_skills: ['Home Cook', 'Tiffin Service', 'Kitchen Assistance', 'Party/Catering Helper'],
      avatar_bg: 'linear-gradient(135deg,#754b4a,#e6a176)',
      created_at: '2026-08-01T08:30:00.000Z'
    },
    {
      id: 'part-4',
      user_id: 'usr-part-4',
      full_name: 'Suresh Yadav',
      initials: 'SY',
      profile_photo: '',
      date_of_birth: '1991-11-05',
      gender: 'Male',
      bio: 'Doorstep steam ironing, dry cleaning pickup & fast fold service with punctuality guaranteed.',
      experience_years: 3,
      service_area: 'Assi, Varanasi',
      service_radius: '3 km',
      service_city: 'Varanasi',
      service_locality: 'Assi',
      verification_status: 'VERIFIED',
      rating: 4.7,
      rating_count: 265,
      completed_jobs: 265,
      response_rate: '99%',
      on_time_rate: '97%',
      starting_price: 79,
      is_online: true,
      primary_skills: ['Ironing', 'Clothes Washing', 'Laundry Pickup & Delivery'],
      avatar_bg: 'linear-gradient(135deg,#3c5773,#99bad2)',
      created_at: '2026-08-02T14:00:00.000Z'
    },
    {
      id: 'part-5',
      user_id: 'usr-part-5',
      full_name: 'Vikram Pandey',
      initials: 'VP',
      profile_photo: '',
      date_of_birth: '1998-06-10',
      gender: 'Male',
      bio: 'Plumbing and pipework specialist. Leaks, fittings, motor installation.',
      experience_years: 2,
      service_area: 'Godowlia, Varanasi',
      service_radius: '5 km',
      service_city: 'Varanasi',
      service_locality: 'Godowlia',
      verification_status: 'PENDING',
      rating: 5.0,
      rating_count: 12,
      completed_jobs: 12,
      response_rate: '90%',
      on_time_rate: '90%',
      starting_price: 149,
      is_online: true,
      primary_skills: ['Plumber', 'RO/Water Purifier Service'],
      avatar_bg: 'linear-gradient(135deg,#41584b,#a2c4b0)',
      created_at: '2026-08-12T16:00:00.000Z'
    }
  ];

  const INITIAL_ADDRESSES = [
    {
      id: 'addr-1',
      user_id: 'usr-cust-1',
      label: 'Home',
      address_line: 'Flat 302, Ganga View Enclave, Near BHU Gate',
      locality: 'Lanka',
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      pincode: '221005',
      landmark: 'Opposite Hyderabad Gate BHU',
      latitude: 25.2677,
      longitude: 82.9913,
      is_default: true,
      created_at: '2026-08-01T10:15:00.000Z'
    },
    {
      id: 'addr-2',
      user_id: 'usr-cust-1',
      label: 'Hostel / Work',
      address_line: 'Room 45, New Girls Hostel, BHU Campus',
      locality: 'BHU',
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      pincode: '221005',
      landmark: 'Near Vishwanath Temple BHU',
      latitude: 25.2750,
      longitude: 82.9900,
      is_default: false,
      created_at: '2026-08-05T14:30:00.000Z'
    }
  ];

  const INITIAL_VERIFICATIONS = [
    {
      id: 'ver-1',
      partner_id: 'part-1',
      partner_name: 'Rahul Kumar',
      verification_type: 'mobile',
      status: 'VERIFIED',
      masked_id: '+91 98••• 22334',
      provider_reference: 'OTP-SIM-78192',
      verified_at: '2026-07-15T09:10:00.000Z',
      reviewed_by: 'system_auto',
      audit_note: 'Instant OTP verified successfully',
      created_at: '2026-07-15T09:05:00.000Z'
    },
    {
      id: 'ver-2',
      partner_id: 'part-1',
      partner_name: 'Rahul Kumar',
      verification_type: 'identity',
      status: 'VERIFIED',
      masked_id: 'Government ID: Verified (Masked Demo •••• 4892)',
      provider_reference: 'KYC-DEMO-99120',
      verified_at: '2026-07-15T12:00:00.000Z',
      reviewed_by: 'usr-adm-1',
      audit_note: 'Approved during onboarding review. Photo & name matched.',
      created_at: '2026-07-15T09:20:00.000Z'
    },
    {
      id: 'ver-3',
      partner_id: 'part-1',
      partner_name: 'Rahul Kumar',
      verification_type: 'address',
      status: 'VERIFIED',
      masked_id: 'Service Area: Lanka, Varanasi (Radius: 5 km)',
      provider_reference: 'ADDR-DEMO-33921',
      verified_at: '2026-07-15T12:05:00.000Z',
      reviewed_by: 'usr-adm-1',
      audit_note: 'Address utility bill demo checked.',
      created_at: '2026-07-15T09:25:00.000Z'
    },
    {
      id: 'ver-4',
      partner_id: 'part-1',
      partner_name: 'Rahul Kumar',
      verification_type: 'skill',
      status: 'VERIFIED',
      masked_id: 'Skills: Electrician (4 yrs), Carpenter (3 yrs)',
      provider_reference: 'SKILL-EVAL-221',
      verified_at: '2026-07-15T14:00:00.000Z',
      reviewed_by: 'usr-adm-1',
      audit_note: 'Practical test and trade experience verified.',
      created_at: '2026-07-15T09:30:00.000Z'
    },
    // Pending verification for demo admin to approve!
    {
      id: 'ver-5',
      partner_id: 'part-5',
      partner_name: 'Vikram Pandey',
      verification_type: 'identity',
      status: 'PENDING',
      masked_id: 'Government ID: Submitted (Masked Demo •••• 7120)',
      provider_reference: 'KYC-DEMO-44019',
      verified_at: null,
      reviewed_by: null,
      audit_note: 'Awaiting admin document review',
      created_at: '2026-08-12T16:15:00.000Z'
    },
    {
      id: 'ver-6',
      partner_id: 'part-5',
      partner_name: 'Vikram Pandey',
      verification_type: 'address',
      status: 'PENDING',
      masked_id: 'Service Area: Godowlia, Varanasi (Radius: 5 km)',
      provider_reference: 'ADDR-DEMO-44020',
      verified_at: null,
      reviewed_by: null,
      audit_note: 'Awaiting address proof verification',
      created_at: '2026-08-12T16:20:00.000Z'
    }
  ];

  const INITIAL_BOOKINGS = [
    {
      id: 'bk-1',
      booking_ref: 'KS-260814-184',
      customer_id: 'cust-1',
      customer_name: 'Shreya Mishra',
      partner_id: 'part-1',
      partner_name: 'Rahul Kumar',
      service_id: 'srv-1',
      service_name: 'Electrician',
      service_icon: '⚡',
      address_id: 'addr-1',
      address_summary: 'Flat 302, Ganga View Enclave, Lanka',
      description: 'Ceiling fan makes grinding noise and regulator sparks.',
      scheduled_time: 'Today · ASAP (15–20 min)',
      status: 'on_the_way', // 'finding_partner' | 'partner_assigned' | 'on_the_way' | 'arrived' | 'service_started' | 'completed' | 'payment_completed' | 'cancelled'
      estimated_price: 208,
      final_price: 208,
      created_at: '2026-08-14T12:30:00.000Z',
      timeline: [
        { time: '12:30 PM', title: 'Booking confirmed', desc: 'Demo booking request registered.' },
        { time: '12:32 PM', title: 'Partner assigned', desc: 'Rahul Kumar accepted your request.' },
        { time: '12:35 PM', title: 'Partner on the way', desc: 'Rahul is heading to Lanka · ETA 12 min.' }
      ]
    },
    {
      id: 'bk-2',
      booking_ref: 'KS-260808-092',
      customer_id: 'cust-1',
      customer_name: 'Shreya Mishra',
      partner_id: 'part-4',
      partner_name: 'Suresh Yadav',
      service_id: 'srv-27',
      service_name: 'Ironing',
      service_icon: '♨',
      address_id: 'addr-1',
      address_summary: 'Flat 302, Ganga View Enclave, Lanka',
      description: '12 shirts and 4 trousers steam pressed & folded.',
      scheduled_time: 'Aug 08 · 4:00 PM',
      status: 'payment_completed',
      estimated_price: 119,
      final_price: 119,
      created_at: '2026-08-08T16:00:00.000Z',
      timeline: [
        { time: 'Aug 08, 04:00 PM', title: 'Service completed', desc: 'Freshly pressed clothes delivered.' },
        { time: 'Aug 08, 04:15 PM', title: 'Payment received', desc: 'Paid ₹119 via UPI.' }
      ]
    },
    {
      id: 'bk-3',
      booking_ref: 'KS-260802-044',
      customer_id: 'cust-1',
      customer_name: 'Shreya Mishra',
      partner_id: 'part-2',
      partner_name: 'Amit Sharma',
      service_id: 'srv-15',
      service_name: 'Home Cleaning',
      service_icon: '☷',
      address_id: 'addr-2',
      address_summary: 'Room 45, New Girls Hostel, BHU',
      description: 'Room turnover and balcony deep clean.',
      scheduled_time: 'Aug 02 · 10:00 AM',
      status: 'payment_completed',
      estimated_price: 377,
      final_price: 377,
      created_at: '2026-08-02T10:00:00.000Z',
      timeline: [
        { time: 'Aug 02, 11:45 AM', title: 'Service completed', desc: 'Room thoroughly sanitized.' },
        { time: 'Aug 02, 11:50 AM', title: 'Payment received', desc: 'Paid ₹377 via Card.' }
      ]
    }
  ];

  const INITIAL_PAYMENTS = [
    {
      id: 'pay-1',
      booking_id: 'bk-1',
      amount: 208,
      payment_method: 'UPI',
      status: 'pending',
      transaction_ref: 'TXN-DEMO-88912',
      created_at: '2026-08-14T12:30:00.000Z'
    },
    {
      id: 'pay-2',
      booking_id: 'bk-2',
      amount: 119,
      payment_method: 'UPI',
      status: 'paid',
      transaction_ref: 'TXN-DEMO-77123',
      created_at: '2026-08-08T16:15:00.000Z'
    },
    {
      id: 'pay-3',
      booking_id: 'bk-3',
      amount: 377,
      payment_method: 'Card',
      status: 'paid',
      transaction_ref: 'TXN-DEMO-66014',
      created_at: '2026-08-02T11:50:00.000Z'
    }
  ];

  const INITIAL_REVIEWS = [
    {
      id: 'rev-1',
      booking_id: 'bk-2',
      customer_id: 'cust-1',
      customer_name: 'Shreya M.',
      partner_id: 'part-4',
      rating: 5,
      comment: 'Super convenient pickup and delivery. Crisp ironed shirts on hangers!',
      created_at: '2026-08-08T17:00:00.000Z'
    },
    {
      id: 'rev-2',
      booking_id: 'bk-3',
      customer_id: 'cust-1',
      customer_name: 'Shreya M.',
      partner_id: 'part-2',
      rating: 5,
      comment: 'Very careful with our move-in boxes and room cleaning.',
      created_at: '2026-08-02T12:30:00.000Z'
    },
    {
      id: 'rev-3',
      booking_id: 'bk-4',
      customer_id: 'cust-2',
      customer_name: 'Arjun S.',
      partner_id: 'part-1',
      rating: 5,
      comment: 'Arrived on time and fixed the ceiling fan & regulator in 20 minutes.',
      created_at: '2026-08-11T18:00:00.000Z'
    }
  ];

  const INITIAL_COMPLAINTS = [
    {
      id: 'cmp-1',
      booking_id: 'bk-old-9',
      user_id: 'usr-cust-1',
      user_name: 'Shreya Mishra',
      category: 'Delay in Arrival',
      description: 'Partner was delayed by 25 minutes due to heavy rain in Godowlia.',
      status: 'resolved',
      resolution_note: 'Customer offered ₹50 goodwill credit in demo account.',
      created_at: '2026-07-28T14:00:00.000Z'
    }
  ];

  const INITIAL_NOTIFICATIONS = [
    {
      id: 'notif-1',
      user_id: 'usr-cust-1',
      title: 'Partner On The Way',
      message: 'Rahul Kumar is on the way for your Fan & Electrical repair (ETA 12 min).',
      type: 'booking',
      read_status: false,
      created_at: '2026-08-14T12:35:00.000Z'
    },
    {
      id: 'notif-2',
      user_id: 'usr-part-1',
      title: 'New Service Request Accepted',
      message: 'You have accepted Electrical Repair at Lanka (₹208 est).',
      type: 'booking',
      read_status: false,
      created_at: '2026-08-14T12:32:00.000Z'
    },
    {
      id: 'notif-3',
      user_id: 'usr-adm-1',
      title: 'New KYC Pending Review',
      message: 'Partner Vikram Pandey submitted government ID for verification.',
      type: 'info',
      read_status: false,
      created_at: '2026-08-12T16:20:00.000Z'
    }
  ];

  // Database State Engine
  class KaamSaathiDB {
    constructor() {
      this.init();
    }

    init() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          this.seedInitial();
        } else {
          this.data = JSON.parse(raw);
          // Auto-repair missing tables if upgraded
          if (!this.data.services || this.data.services.length < 50) {
            this.data.services = SEED_SERVICES;
            this.save();
          }
        }
      } catch (err) {
        console.warn('Storage read failed, re-seeding database', err);
        this.seedInitial();
      }
    }

    seedInitial() {
      this.data = {
        users: INITIAL_USERS,
        customers: INITIAL_CUSTOMERS,
        partners: INITIAL_PARTNERS,
        services: SEED_SERVICES,
        addresses: INITIAL_ADDRESSES,
        verifications: INITIAL_VERIFICATIONS,
        bookings: INITIAL_BOOKINGS,
        payments: INITIAL_PAYMENTS,
        reviews: INITIAL_REVIEWS,
        complaints: INITIAL_COMPLAINTS,
        notifications: INITIAL_NOTIFICATIONS,
        audit_logs: [
          {
            id: 'aud-1',
            action: 'SYSTEM_INITIALIZE',
            performed_by: 'system',
            details: 'KaamSaathi Relational Database initialized with demo data.',
            timestamp: new Date().toISOString()
          }
        ]
      };
      this.save();
    }

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        window.dispatchEvent(new CustomEvent('ks:db_updated', { detail: { timestamp: Date.now() } }));
      } catch (err) {
        console.error('Database save error', err);
      }
    }

    resetToDemo() {
      localStorage.removeItem(STORAGE_KEY);
      this.seedInitial();
      return true;
    }

    table(tableName) {
      if (!this.data[tableName]) {
        this.data[tableName] = [];
      }
      return this.data[tableName];
    }

    find(tableName, predicate) {
      return this.table(tableName).find(predicate) || null;
    }

    filter(tableName, predicate) {
      return this.table(tableName).filter(predicate);
    }

    insert(tableName, record) {
      const list = this.table(tableName);
      if (!record.id) {
        record.id = `${tableName.slice(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }
      if (!record.created_at) {
        record.created_at = new Date().toISOString();
      }
      list.unshift(record);
      this.save();
      return record;
    }

    update(tableName, id, patch) {
      const list = this.table(tableName);
      const index = list.findIndex(r => r.id === id);
      if (index === -1) return null;
      list[index] = { ...list[index], ...patch, updated_at: new Date().toISOString() };
      this.save();
      return list[index];
    }

    delete(tableName, id) {
      const list = this.table(tableName);
      const index = list.findIndex(r => r.id === id);
      if (index === -1) return false;
      list.splice(index, 1);
      this.save();
      return true;
    }

    getUserByEmail(email) {
      if (!email) return null;
      return this.find('users', u => u.email.toLowerCase() === email.trim().toLowerCase());
    }

    getUserByPhone(phone) {
      if (!phone) return null;
      const clean = phone.replace(/[^0-9]/g, '');
      return this.find('users', u => u.phone.replace(/[^0-9]/g, '').endsWith(clean.slice(-10)));
    }

    getCustomerByUserId(userId) {
      return this.find('customers', c => c.user_id === userId);
    }

    getPartnerByUserId(userId) {
      return this.find('partners', p => p.user_id === userId);
    }

    getAddressesForUser(userId) {
      return this.filter('addresses', a => a.user_id === userId);
    }

    getVerificationsForPartner(partnerId) {
      return this.filter('verifications', v => v.partner_id === partnerId);
    }

    getBookingsForCustomer(customerId) {
      return this.filter('bookings', b => b.customer_id === customerId);
    }

    getBookingsForPartner(partnerId) {
      return this.filter('bookings', b => b.partner_id === partnerId);
    }

    getNotificationsForUser(userId) {
      return this.filter('notifications', n => n.user_id === userId);
    }

    markNotificationRead(notifId) {
      return this.update('notifications', notifId, { read_status: true });
    }

    logAudit(action, performedBy, details) {
      this.insert('audit_logs', {
        id: `aud-${Date.now()}`,
        action,
        performed_by: performedBy,
        details,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Attach global instance
  root.DB = new KaamSaathiDB();

})(typeof window !== 'undefined' ? window : this);
