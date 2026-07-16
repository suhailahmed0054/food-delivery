export type Category = "Appetizers" | "Mains" | "Desserts" | "Beverages";

export type MenuItem = {
  id: string;
  name: string;
  category: Category;
  price: number;
  available: boolean;
  bestSeller?: boolean;
  featured?: boolean;
  todaySpecial?: boolean;
  rating: number;
  reviews: number;
  image: string;
  description: string;
  ingredients: string[];
  allergens: string[];
  customization: {
    sizes: Array<{ name: string; priceDelta: number }>;
    spiceLevels: string[];
    addOns: Array<{ name: string; price: number }>;
  };
};

export const restaurant = {
  name: "Al-Arab Restaurant",
  rating: 4.8,
  reviews: 2840,
  deliveryTime: "25-35 min",
  deliveryFee: 39,
  minimumOrder: 199,
  taxRate: 0.05,
  address: "Vijayapura,Devanahalli,karnataka-562135",
  phone: "+91 98765 43210"
};

export const categories: Category[] = ["Appetizers", "Mains", "Desserts", "Beverages"];

export const menuItems: MenuItem[] = [
  {
    id: "hummus-pita",
    name: "Hummus & Pita",
    category: "Appetizers",
    price: 149,
    available: true,
    bestSeller: true,
    featured: true,
    todaySpecial: true,
    rating: 4.5,
    reviews: 320,
    image: "https://images.unsplash.com/photo-1577906096429-f73c2c312435?auto=format&fit=crop&w=900&q=80",
    description: "Creamy chickpea hummus with olive oil, paprika and warm pita.",
    ingredients: ["Chickpeas", "Tahini", "Olive oil", "Pita"],
    allergens: ["Sesame", "Gluten"],
    customization: {
      sizes: [
        { name: "Regular", priceDelta: 0 },
        { name: "Family", priceDelta: 90 }
      ],
      spiceLevels: ["Mild", "Medium", "Hot"],
      addOns: [
        { name: "Extra pita", price: 35 },
        { name: "Olives", price: 40 }
      ]
    }
  },
  {
    id: "falafel-box",
    name: "Falafel Box",
    category: "Appetizers",
    price: 199,
    available: true,
    bestSeller: true,
    featured: true,
    todaySpecial: false,
    rating: 4.4,
    reviews: 214,
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
    description: "Crisp falafel, tahini dip, pickles, salad and fresh bread.",
    ingredients: ["Chickpeas", "Parsley", "Tahini", "Pickles"],
    allergens: ["Sesame", "Gluten"],
    customization: {
      sizes: [
        { name: "6 pcs", priceDelta: 0 },
        { name: "10 pcs", priceDelta: 100 }
      ],
      spiceLevels: ["Mild", "Medium", "Hot"],
      addOns: [
        { name: "Garlic dip", price: 25 },
        { name: "Tahini dip", price: 25 }
      ]
    }
  },
  {
    id: "chicken-mandi",
    name: "Chicken Mandi",
    category: "Mains",
    price: 349,
    available: true,
    bestSeller: true,
    featured: true,
    todaySpecial: true,
    rating: 4.8,
    reviews: 710,
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    description: "Smoky mandi rice, tender chicken, salata and garlic sauce.",
    ingredients: ["Chicken", "Basmati rice", "Mandi spice", "Saffron"],
    allergens: ["Dairy"],
    customization: {
      sizes: [
        { name: "Quarter", priceDelta: 0 },
        { name: "Half", priceDelta: 210 },
        { name: "Full", priceDelta: 540 }
      ],
      spiceLevels: ["Mild", "Medium", "Hot", "Extra hot"],
      addOns: [
        { name: "Extra rice", price: 80 },
        { name: "Boiled egg", price: 30 },
        { name: "Garlic sauce", price: 25 }
      ]
    }
  },
  {
    id: "mutton-mandi",
    name: "Mutton Mandi",
    category: "Mains",
    price: 549,
    available: true,
    bestSeller: true,
    featured: true,
    todaySpecial: false,
    rating: 4.9,
    reviews: 540,
    image: "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=900&q=80",
    description: "Slow-cooked mutton over saffron rice with nuts and gravy.",
    ingredients: ["Mutton", "Basmati rice", "Cashew", "Saffron"],
    allergens: ["Nuts", "Dairy"],
    customization: {
      sizes: [
        { name: "Single", priceDelta: 0 },
        { name: "Family", priceDelta: 520 }
      ],
      spiceLevels: ["Mild", "Medium", "Hot"],
      addOns: [
        { name: "Extra mutton", price: 220 },
        { name: "Extra rice", price: 80 }
      ]
    }
  },
  {
    id: "mixed-grill",
    name: "Mixed Arabic Grill",
    category: "Mains",
    price: 699,
    available: true,
    bestSeller: true,
    featured: true,
    todaySpecial: true,
    rating: 4.7,
    reviews: 430,
    image: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=900&q=80",
    description: "Seekh kebab, tikka, grilled chicken, pita, pickles and dips.",
    ingredients: ["Chicken", "Mutton", "Pita", "Garlic sauce"],
    allergens: ["Gluten", "Dairy"],
    customization: {
      sizes: [
        { name: "Regular", priceDelta: 0 },
        { name: "Party", priceDelta: 650 }
      ],
      spiceLevels: ["Mild", "Medium", "Hot"],
      addOns: [
        { name: "Extra kebab", price: 160 },
        { name: "Fries", price: 90 }
      ]
    }
  },
  {
    id: "shawarma",
    name: "Loaded Shawarma",
    category: "Mains",
    price: 179,
    available: true,
    bestSeller: true,
    featured: true,
    todaySpecial: false,
    rating: 4.6,
    reviews: 620,
    image: "https://images.unsplash.com/photo-1662116765994-1e4200c43589?auto=format&fit=crop&w=900&q=80",
    description: "Juicy chicken, tahini, garlic mayo, fries and crisp salad.",
    ingredients: ["Chicken", "Pita", "Garlic mayo", "Fries"],
    allergens: ["Gluten", "Egg"],
    customization: {
      sizes: [
        { name: "Regular", priceDelta: 0 },
        { name: "Jumbo", priceDelta: 80 }
      ],
      spiceLevels: ["Mild", "Medium", "Hot"],
      addOns: [
        { name: "Cheese", price: 35 },
        { name: "Extra chicken", price: 70 }
      ]
    }
  },
  {
    id: "kunafa",
    name: "Cream Kunafa",
    category: "Desserts",
    price: 249,
    available: true,
    bestSeller: false,
    featured: true,
    todaySpecial: false,
    rating: 4.9,
    reviews: 302,
    image: "https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&w=900&q=80",
    description: "Crisp kataifi pastry, cream filling, pistachio and syrup.",
    ingredients: ["Kataifi", "Cream", "Pistachio", "Sugar syrup"],
    allergens: ["Dairy", "Nuts", "Gluten"],
    customization: {
      sizes: [
        { name: "Single", priceDelta: 0 },
        { name: "Family", priceDelta: 300 }
      ],
      spiceLevels: ["Regular"],
      addOns: [
        { name: "Extra pistachio", price: 45 },
        { name: "Ice cream scoop", price: 60 }
      ]
    }
  },
  {
    id: "mint-lime",
    name: "Mint Lime Cooler",
    category: "Beverages",
    price: 99,
    available: false,
    bestSeller: false,
    featured: false,
    todaySpecial: false,
    rating: 4.3,
    reviews: 115,
    image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=900&q=80",
    description: "Fresh lime, mint, crushed ice and sparkling soda.",
    ingredients: ["Lime", "Mint", "Soda", "Sugar"],
    allergens: [],
    customization: {
      sizes: [
        { name: "Regular", priceDelta: 0 },
        { name: "Large", priceDelta: 40 }
      ],
      spiceLevels: ["Regular"],
      addOns: [
        { name: "Less sugar", price: 0 },
        { name: "Extra mint", price: 10 }
      ]
    }
  }
];

export const orderTimeline = [
  "Order Confirmed",
  "Payment Verified",
  "Preparing",
  "Out for Delivery",
  "Delivered"
];

export const adminOrders = [
  {
    id: "AR-1042",
    customer: "Ayesha Khan",
    phone: "+91 90000 11223",
    address: "Road 12, Banjara Hills",
    items: "2 Chicken Mandi, 1 Kunafa",
    total: 986,
    status: "New",
    prep: "25 min",
    instructions: "Less oil, extra garlic sauce"
  },
  {
    id: "AR-1041",
    customer: "Rahul Mehta",
    phone: "+91 90000 55443",
    address: "Jubilee Hills Check Post",
    items: "Mixed Grill, Mint Lime Cooler",
    total: 837,
    status: "Preparing",
    prep: "18 min",
    instructions: "Call at gate"
  },
  {
    id: "AR-1040",
    customer: "Sameer Ali",
    phone: "+91 90000 77889",
    address: "Madhapur Metro",
    items: "Mutton Mandi Family",
    total: 1118,
    status: "Ready",
    prep: "Ready",
    instructions: "Send plates"
  }
];
