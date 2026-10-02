import type Database from "better-sqlite3";

/** Splits a source "Coverage" string into Duration / Store Coverage / Channel
 *  by position — the source tables are not perfectly consistent in column
 *  order, so coverage_raw always keeps the full original string regardless. */
function splitCoverage(raw: string): { duration: string | null; storeCoverage: string | null; channel: string | null } {
  const parts = raw.split("/").map((s) => s.trim()).filter(Boolean);
  return {
    duration: parts[0] ?? null,
    storeCoverage: parts[1] ?? null,
    channel: parts.slice(2).join(" / ") || null,
  };
}

interface ServiceSeed {
  id: string;
  category: string;
  service_name: string;
  package?: string | null;
  description: string;
  price_gbp: string | null;
  price_usd: string | null;
  price_eur: string | null;
  coverage: string | null;
  notes?: string | null;
  status?: "CURRENT" | "HISTORICAL" | "NEEDS VERIFICATION";
}

const SOURCE_2027 = "Longdan 2027 A&P Marketing Services — supplied 2026-10-01";
const SOURCE_2026 = "Longdan Marketing & In-store Promotions SERVICES 2026 — supplied 2026-10-01";
const CAMPAIGN_NOTE_2027 = "Promotion items and FOCs are excluded unless specifically included in the selected package.";

/** Short Vietnamese quick-read explanations — not literal translations of the
 *  English description, standard terms (Golden Week, A&P, Demo...) are kept in
 *  English per the bilingual Master spec. Keyed by service_name since the same
 *  name recurs across 2026/2027 rows; volume-discount tiers keyed by id instead
 *  since their names differ only by session range. */
const SERVICE_VI: Record<string, string> = {
  "Essential Campaign — Golden Weeks": "Gói tham gia Golden Week — có A4 poster, wobbler, banner website, email và social.",
  "Premium Campaign — Monthly Campaign": "Gói Monthly Campaign nâng cao — POSM đầy đủ (A4 poster, wobbler, price strip) + hiện diện digital.",
  "Full Impact Campaign — Branded Campaign with Additional POSM": "Gói cao cấp nhất — POSM đầy đủ, digital, hỗ trợ khuyến mãi và FOC.",
  "Seasonal Campaign": "Chiến dịch theo mùa/dịp lễ lớn, linh hoạt 2–4 tuần.",
  "New Product Launch": "Gói ra mắt sản phẩm mới — kết hợp in-store và digital.",
  "Listing Marketing Campaigns": "Phí listing chiến dịch theo năm (Golden Week hoặc Monthly Campaign tuỳ gói Basic/Premium/Diamond).",
  "Branded Shelf Line": "Một dãy kệ có thương hiệu riêng, kèm shelf-talker/wobbler.",
  "Branded Gondola": "Kệ trưng bày đầu kệ (gondola) có thương hiệu riêng, vị trí nổi bật.",
  "Branded Fridge": "Tủ mát có thương hiệu riêng cho sản phẩm cần bảo quản lạnh.",
  "Branded Freezer": "Tủ đông có thương hiệu riêng.",
  "Branded FSDU": "Kệ trưng bày đứng độc lập (FSDU) do nhà cung cấp cấp.",
  "Branded Standing Display (FSDU)": "Kệ trưng bày đứng độc lập (FSDU) do nhà cung cấp cấp.",
  "Digital Shelf Screen": "Màn hình số nhỏ gắn cạnh kệ để chiếu video/nội dung sản phẩm.",
  "Shelf/Fridge/Freezer-edge Digital Screen": "Màn hình số nhỏ gắn cạnh kệ/tủ mát/tủ đông để chiếu video sản phẩm.",
  "Supplier-Led Demo": "Demo do nhân viên nhà cung cấp thực hiện, Longdan hỗ trợ setup.",
  "Supplier-Led Alcohol Demo": "Demo đồ uống có cồn do nhà cung cấp thực hiện, Longdan hỗ trợ vận hành.",
  "Longdan Staff Demo": "Demo do chính nhân viên Longdan thực hiện (năm 2026 chỉ áp dụng snack/đồ uống, không nấu/không cồn).",
  "Licensed Agent Demo": "Demo do agent có giấy phép thực hiện, Longdan điều phối.",
  "Licensed Agent Led Alcohol Demo": "Demo đồ uống có cồn do agent có giấy phép thực hiện.",
  "In-store Demonstration": "Demo tại cửa hàng — xem cột Package để biết do Supplier / Longdan Staff / Licensed Agent thực hiện.",
  "Landing Page": "Trang landing page riêng cho thương hiệu/sản phẩm, có hỗ trợ website/email/social/SEO.",
  "Email Marketing": "Gửi email quảng bá thương hiệu tới danh sách khách hàng Longdan.",
  "Social Media Feature": "Đăng bài nổi bật thương hiệu/sản phẩm trên kênh social của Longdan.",
  "Livestream Brand Spotlight": "Giới thiệu sản phẩm nổi bật trong buổi livestream của Longdan.",
  "Livestream": "Giới thiệu sản phẩm nổi bật trong buổi livestream của Longdan.",
  "In-Store TVC": "Video quảng cáo chiếu trên màn hình số tại cửa hàng Longdan.",
  "TVC": "Video quảng cáo chiếu trên màn hình số tại cửa hàng Longdan.",
  "Last-Mile Campaign": "Quảng bá sản phẩm trên các nền tảng giao đồ ăn (Uber Eats, Deliveroo, Hungry Panda).",
  "Brand Launch Package": "Gói ra mắt thương hiệu trọn gói — Landing Page + Campaign + POSM + Email + Social + TVC + 1 Demo.",
  "Seasonal Campaign Package": "Gói chiến dịch theo mùa trọn gói — campaign + POSM + digital + email + social + TVC.",
  "Full-Funnel Brand Package": "Gói đầy đủ phễu thương hiệu — campaign + in-store + landing page + email + social + TVC + livestream.",
  "Annual Visibility Package": "Gói hiện diện trọn năm — campaign quanh năm + digital + in-store + ưu tiên vị trí chiến dịch.",
  "POSM Campaign Support": "Nhà cung cấp cấp POSM, Longdan hỗ trợ lên kế hoạch, điều phối, phân phối và thực thi tại cửa hàng.",
  "Branded Gift Campaign Support": "Nhà cung cấp cấp quà tặng thương hiệu, Longdan quản lý điều phối và phân bổ cửa hàng.",
  "POSM + Gift Activation": "Kết hợp POSM và quà tặng thương hiệu, Longdan quản lý toàn bộ setup và thực thi.",
};

const SERVICE_VI_BY_ID: Record<string, string> = {
  "s27-vol-9-18": "Cam kết 9–18 buổi demo/năm → giảm thêm 5%.",
  "s27-vol-19-24": "Cam kết 19–24 buổi demo/năm → giảm thêm 8%.",
  "s27-vol-25-36": "Cam kết 25–36 buổi demo/năm → giảm thêm 10%.",
  "s27-vol-37-47": "Cam kết 37–47 buổi demo/năm → giảm thêm 12%.",
  "s27-vol-48plus": "Cam kết từ 48 buổi demo/năm trở lên → giảm thêm 15%.",
};

const SERVICES_2027: ServiceSeed[] = [
  // CAMPAIGN MARKETING
  { id: "s27-camp-essential", category: "CAMPAIGN MARKETING", service_name: "Essential Campaign — Golden Weeks", description: "Product participation with A4 poster, wobbler, website banner, email and social media exposure.", price_gbp: "£1,100", price_usd: "$1,495", price_eur: "€1,285", coverage: "2 weeks / 13 stores / Retail", notes: CAMPAIGN_NOTE_2027 },
  { id: "s27-camp-premium", category: "CAMPAIGN MARKETING", service_name: "Premium Campaign — Monthly Campaign", description: "Enhanced POSM including A4 poster, wobbler and price strip, plus digital exposure.", price_gbp: "£2,250", price_usd: "$3,050", price_eur: "€2,625", coverage: "4 weeks / 13 stores / Retail + Online", notes: CAMPAIGN_NOTE_2027 },
  { id: "s27-camp-full-impact", category: "CAMPAIGN MARKETING", service_name: "Full Impact Campaign — Branded Campaign with Additional POSM", description: "Premium POSM, digital exposure, promotional support and FOC participation.", price_gbp: "£2,850", price_usd: "$3,865", price_eur: "€3,325", coverage: "4 weeks / 13 stores / Retail + Online + Wholesale", notes: CAMPAIGN_NOTE_2027 },
  { id: "s27-camp-seasonal", category: "CAMPAIGN MARKETING", service_name: "Seasonal Campaign", description: "Dedicated campaign around major seasonal occasions.", price_gbp: "£1,500–£2,500", price_usd: "$2,050–$3,385", price_eur: "€1,750–€2,915", coverage: "2–4 weeks / Selected or all stores / Retail + Online", notes: CAMPAIGN_NOTE_2027 },
  { id: "s27-camp-launch", category: "CAMPAIGN MARKETING", service_name: "New Product Launch", description: "Integrated launch support covering in-store and digital channels.", price_gbp: "£1,500–£2,000", price_usd: "$2,050–$3,385", price_eur: "€1,750–€2,915", coverage: "4-6 weeks / Selected or all stores / Retail + Online", notes: CAMPAIGN_NOTE_2027 },

  // IN-STORE VISIBILITY
  { id: "s27-instore-shelfline", category: "IN-STORE VISIBILITY", service_name: "Branded Shelf Line", description: "Dedicated branded shelf presence with shelf-talker/wobbler + Branded Tag.", price_gbp: "£600", price_usd: "$815", price_eur: "€700", coverage: "3 months / All stores / Retail" },
  { id: "s27-instore-gondola-basic", category: "IN-STORE VISIBILITY", service_name: "Branded Gondola", package: "Basic", description: "Dedicated branded gondola for high-visibility product placement.", price_gbp: "£1,200", price_usd: "$1,625", price_eur: "€1,400", coverage: "6 months / Per store / Retail" },
  { id: "s27-instore-gondola-premium", category: "IN-STORE VISIBILITY", service_name: "Branded Gondola", package: "Premium", description: "Long-term branded gondola with sustained visibility.", price_gbp: "£1,750", price_usd: "$2,375", price_eur: "€2,045", coverage: "12 months / Per store / Retail" },
  { id: "s27-instore-fridge-basic", category: "IN-STORE VISIBILITY", service_name: "Branded Fridge", package: "Basic", description: "Dedicated branded fridge space for chilled products.", price_gbp: "£2,250", price_usd: "$3,050", price_eur: "€2,625", coverage: "6 months / Per store / Retail" },
  { id: "s27-instore-fridge-premium", category: "IN-STORE VISIBILITY", service_name: "Branded Fridge", package: "Premium", description: "Year-round branded fridge presence.", price_gbp: "£3,400", price_usd: "$4,605", price_eur: "€3,965", coverage: "12 months / Per store / Retail" },
  { id: "s27-instore-freezer-basic", category: "IN-STORE VISIBILITY", service_name: "Branded Freezer", package: "Basic", description: "Dedicated branded freezer display.", price_gbp: "£2,250", price_usd: "$3,050", price_eur: "€2,625", coverage: "6 months / Per store / Retail" },
  { id: "s27-instore-freezer-premium", category: "IN-STORE VISIBILITY", service_name: "Branded Freezer", package: "Premium", description: "Long-term branded freezer presence.", price_gbp: "£3,400", price_usd: "$4,605", price_eur: "€3,965", coverage: "12 months / Per store / Retail" },
  { id: "s27-instore-fsdu-basic", category: "IN-STORE VISIBILITY", service_name: "Branded FSDU", package: "Basic", description: "Supplier-provided floor-standing display.", price_gbp: "£700", price_usd: "$950", price_eur: "€815", coverage: "6 months / Per store / Retail" },
  { id: "s27-instore-fsdu-premium", category: "IN-STORE VISIBILITY", service_name: "Branded FSDU", package: "Premium", description: "Supplier-provided FSDU with extended placement.", price_gbp: "£1,200", price_usd: "$1,625", price_eur: "€1,400", coverage: "12 months / Per store / Retail" },
  { id: "s27-instore-digiscreen", category: "IN-STORE VISIBILITY", service_name: "Digital Shelf Screen", description: "Product/video content displayed alongside the product.", price_gbp: "£250", price_usd: "$345", price_eur: "€295", coverage: "1 month / Per screen / Per store" },

  // ACTIVATION & DEMONSTRATION
  { id: "s27-demo-supplier-short", category: "ACTIVATION & DEMONSTRATION", service_name: "Supplier-Led Demo", package: "3–4 hours", description: "Supplier representative conducts the demonstration with Longdan support.", price_gbp: "£65", price_usd: "$90", price_eur: "€75", coverage: "3–4 hours / 1 store / 1 session" },
  { id: "s27-demo-supplier-long", category: "ACTIVATION & DEMONSTRATION", service_name: "Supplier-Led Demo", package: "6-7 hours", description: "Supplier representative conducts the demonstration with Longdan support.", price_gbp: "£115", price_usd: "$155", price_eur: "€135", coverage: "6-7 hours / 1 store / 1 session" },
  { id: "s27-demo-supplier-alcohol", category: "ACTIVATION & DEMONSTRATION", service_name: "Supplier-Led Alcohol Demo", description: "Supplier-led alcohol demonstration with Longdan operational support.", price_gbp: "£165", price_usd: "$225", price_eur: "€195", coverage: "4-5 hours / 1 store / 1 session" },
  { id: "s27-demo-longdan-staff", category: "ACTIVATION & DEMONSTRATION", service_name: "Longdan Staff Demo", description: "Demonstration delivered by Longdan staff including setup and customer engagement.", price_gbp: "£225", price_usd: "$305", price_eur: "€265", coverage: "3–4 hours / 1 store / 1 session" },
  { id: "s27-demo-licensed-agent", category: "ACTIVATION & DEMONSTRATION", service_name: "Licensed Agent Demo", description: "Professional licensed agent conducts the demonstration with Longdan coordination.", price_gbp: "£285", price_usd: "$385", price_eur: "€335", coverage: "3–4 hours / 1 store / 1 session" },
  { id: "s27-demo-licensed-agent-alcohol", category: "ACTIVATION & DEMONSTRATION", service_name: "Licensed Agent Led Alcohol Demo", description: "Professional licensed agent conducts the demonstration with Longdan coordination.", price_gbp: "£385", price_usd: "$520", price_eur: "€450", coverage: "4-5 hours / 1 store / 1 session" },

  // VOLUME DISCOUNT (Demo, 2027)
  { id: "s27-vol-9-18", category: "VOLUME DISCOUNT", service_name: "Annual Demo Commitment — 9–18 sessions", description: "5% additional discount on demo activities.", price_gbp: null, price_usd: null, price_eur: null, coverage: null, notes: "Applies to annual demo activity volume commitment." },
  { id: "s27-vol-19-24", category: "VOLUME DISCOUNT", service_name: "Annual Demo Commitment — 19–24 sessions", description: "8% additional discount on demo activities.", price_gbp: null, price_usd: null, price_eur: null, coverage: null, notes: "Applies to annual demo activity volume commitment." },
  { id: "s27-vol-25-36", category: "VOLUME DISCOUNT", service_name: "Annual Demo Commitment — 25–36 sessions", description: "10% additional discount on demo activities.", price_gbp: null, price_usd: null, price_eur: null, coverage: null, notes: "Applies to annual demo activity volume commitment." },
  { id: "s27-vol-37-47", category: "VOLUME DISCOUNT", service_name: "Annual Demo Commitment — 37–47 sessions", description: "12% additional discount on demo activities.", price_gbp: null, price_usd: null, price_eur: null, coverage: null, notes: "Applies to annual demo activity volume commitment." },
  { id: "s27-vol-48plus", category: "VOLUME DISCOUNT", service_name: "Annual Demo Commitment — 48+ sessions", description: "15% additional discount on demo activities.", price_gbp: null, price_usd: null, price_eur: null, coverage: null, notes: "Applies to annual demo activity volume commitment." },

  // DIGITAL MARKETING
  { id: "s27-digital-landing", category: "DIGITAL MARKETING", service_name: "Landing Page", description: "Dedicated brand/product page with website, email, social and basic SEO support.", price_gbp: "£1,350", price_usd: "$1,835", price_eur: "€1,575", coverage: "4 weeks / Online / Retail + Wholesale audience" },
  { id: "s27-digital-email", category: "DIGITAL MARKETING", service_name: "Email Marketing", description: "Dedicated supplier feature to Longdan customer databases.", price_gbp: "£450", price_usd: "$610", price_eur: "€525", coverage: "1 campaign / Online + Wholesale / 1-month campaign period" },
  { id: "s27-digital-social", category: "DIGITAL MARKETING", service_name: "Social Media Feature", description: "Dedicated brand/product feature across Longdan social channels.", price_gbp: "£400", price_usd: "$545", price_eur: "€465", coverage: "1 campaign / Social audience / 2–4 weeks" },
  { id: "s27-digital-livestream", category: "DIGITAL MARKETING", service_name: "Livestream Brand Spotlight", description: "Host-led product presentation during Longdan livestream.", price_gbp: "£450", price_usd: "$610", price_eur: "€525", coverage: "1 livestream session / Online audience" },
  { id: "s27-digital-tvc", category: "DIGITAL MARKETING", service_name: "In-Store TVC", description: "Supplier video displayed across Longdan digital screens.", price_gbp: "£500", price_usd: "$675", price_eur: "€585", coverage: "1 month / 13 stores / 53 digital screens" },
  { id: "s27-digital-lastmile", category: "DIGITAL MARKETING", service_name: "Last-Mile Campaign", description: "Dedicated product promotion across third-party delivery platforms such as Uber Eats, Deliveroo and Hungry Panda designed to increase product visibility and drive online orders from customers in the local delivery market.", price_gbp: "£1,350", price_usd: "$1,835", price_eur: "€1,575", coverage: "2–4 weeks / Online + In-store customer journey" },

  // PREMIUM PACKAGES
  { id: "s27-pkg-brand-launch", category: "PREMIUM PACKAGES", service_name: "Brand Launch Package", description: "Landing Page + Campaign + POSM + Email + Social + TVC + 1 Demo.", price_gbp: "£3,500", price_usd: "$4,745", price_eur: "€4,085", coverage: "4 weeks / Up to 13 stores / Retail + Online" },
  { id: "s27-pkg-seasonal", category: "PREMIUM PACKAGES", service_name: "Seasonal Campaign Package", description: "Seasonal campaign + POSM + digital + email + social + TVC.", price_gbp: "£3,000", price_usd: "$4,065", price_eur: "€3,500", coverage: "2–4 weeks / Up to 13 stores / Retail + Online" },
  { id: "s27-pkg-fullfunnel", category: "PREMIUM PACKAGES", service_name: "Full-Funnel Brand Package", description: "Campaign + in-store visibility + landing page + email + social + TVC + livestream.", price_gbp: "£4,500", price_usd: "$6,095", price_eur: "€5,255", coverage: "4 weeks / 13 stores / Retail + Online + Wholesale" },
  { id: "s27-pkg-annual", category: "PREMIUM PACKAGES", service_name: "Annual Visibility Package", description: "Year-round campaigns + digital support + in-store visibility + priority campaign placement.", price_gbp: "£8,000–£12,000", price_usd: "$10,835–$16,255", price_eur: "€9,345–€14,000", coverage: "12 months / Multi-store 6-12 Stores / Retail + Online + Wholesale" },

  // POSM & BRAND ACTIVATION SUPPORT
  { id: "s27-posm-support", category: "POSM & BRAND ACTIVATION", service_name: "POSM Campaign Support", description: "Supplier provides POSM materials. Longdan supports campaign planning, POSM coordination, store communication, distribution and in-store execution.", price_gbp: "£150", price_usd: "$205", price_eur: "€175", coverage: "Per campaign / Up to 13 stores / 2–4 weeks" },
  { id: "s27-posm-gift", category: "POSM & BRAND ACTIVATION", service_name: "Branded Gift Campaign Support", description: "Supplier provides branded gifts or customer giveaways. Longdan manages campaign coordination, store allocation, operational instructions and execution monitoring.", price_gbp: "£200", price_usd: "$275", price_eur: "€235", coverage: "Per campaign / Up to 13 stores / 2–4 weeks" },
  { id: "s27-posm-gift-combo", category: "POSM & BRAND ACTIVATION", service_name: "POSM + Gift Activation", description: "Integrated campaign using supplier-provided POSM and branded gifts, with Longdan managing campaign setup, store coordination, distribution and execution.", price_gbp: "£250", price_usd: "$345", price_eur: "€295", coverage: "Per campaign / Up to 13 stores / 2–4 weeks" },
];

const SERVICES_2026: ServiceSeed[] = [
  // 1. Listing Marketing Campaigns
  { id: "s26-listing-basic", category: "CAMPAIGN MARKETING", service_name: "Listing Marketing Campaigns", package: "Basic", description: "Listing fee per campaign, including 6 Golden Week campaigns, covering retail. POSM display includes: A4 poster, wobbler, printed by LD. Digital promotion includes: Website banner, email, and social media promotion. Excludes Promotion and FOCs for campaign.", price_gbp: "£1,000", price_usd: "$1,265", price_eur: "€1,200", coverage: "Per Golden Week Campaign in 2 weeks" },
  { id: "s26-listing-premium", category: "CAMPAIGN MARKETING", service_name: "Listing Marketing Campaigns", package: "Premium", description: "Listing fee per campaign, covering 12 monthly campaigns, covering retail. POSM display includes: A4 poster, wobbler, price strip, printed by LD. Digital promotion includes: Website banner, email, and social media promotion. Excludes Promotion and FOCs for campaign.", price_gbp: "£2,000", price_usd: "$2,525", price_eur: "€2,400", coverage: "Per Monthly Campaign in 4 weeks" },
  { id: "s26-listing-diamond", category: "CAMPAIGN MARKETING", service_name: "Listing Marketing Campaigns", package: "Diamond", description: "Listing fee per campaign, covering 12 monthly campaigns, covering retail. POSM display includes: A4 poster, wobbler, price strip, printed by LD. Digital promotion includes: Website banner, email, and social media promotion. Includes Promotion and FOCs for campaign.", price_gbp: "£2,500", price_usd: "$3,160", price_eur: "€3,000", coverage: "Per Monthly Campaign in 4 weeks" },

  // 2. Branded Fixtures & Displays
  { id: "s26-fixture-shelfline", category: "IN-STORE VISIBILITY", service_name: "Branded Shelf Line", description: "One eye-catching shelf line with shelf-talker or wobbler display.", price_gbp: "£500", price_usd: "$635", price_eur: "€600", coverage: "All stores, 3 months" },
  { id: "s26-fixture-digiscreen", category: "IN-STORE VISIBILITY", service_name: "Shelf/Fridge/Freezer-edge Digital Screen", description: "Small digital screen mounted on the shelf, fridge, or freezer edge to showcase promotional videos alongside the products.", price_gbp: "£200", price_usd: "$265", price_eur: "€240", coverage: "Per branded shelf/fridge/freezer per store" },
  { id: "s26-fixture-gondola-basic", category: "IN-STORE VISIBILITY", service_name: "Branded Gondola", package: "Basic", description: "Display for 6 months.", price_gbp: "£1,000", price_usd: "$1,265", price_eur: "€1,200", coverage: "Per store, 6 months" },
  { id: "s26-fixture-gondola-premium", category: "IN-STORE VISIBILITY", service_name: "Branded Gondola", package: "Premium", description: "Display for 12 months.", price_gbp: "£1,500", price_usd: "$1,895", price_eur: "€1,800", coverage: "Per store, 12 months" },
  { id: "s26-fixture-fridge-basic", category: "IN-STORE VISIBILITY", service_name: "Branded Fridge", package: "Basic", description: "Display for 6 months.", price_gbp: "£2,000", price_usd: "$2,525", price_eur: "€2,400", coverage: "Per store, 6 months" },
  { id: "s26-fixture-fridge-premium", category: "IN-STORE VISIBILITY", service_name: "Branded Fridge", package: "Premium", description: "Display for 12 months.", price_gbp: "£3,000", price_usd: "$3,785", price_eur: "€3,600", coverage: "Per store, 12 months" },
  { id: "s26-fixture-freezer-basic", category: "IN-STORE VISIBILITY", service_name: "Branded Freezer", package: "Basic", description: "Display for 6 months.", price_gbp: "£2,000", price_usd: "$2,525", price_eur: "€2,400", coverage: "Per store, 6 months" },
  { id: "s26-fixture-freezer-premium", category: "IN-STORE VISIBILITY", service_name: "Branded Freezer", package: "Premium", description: "Display for 12 months.", price_gbp: null, price_usd: "$3,785", price_eur: "€3,600", coverage: "Per store, 12 months", notes: "GBP price missing from source table (shown as \"_\") — not invented.", status: "NEEDS VERIFICATION" },
  { id: "s26-fixture-fsdu-basic", category: "IN-STORE VISIBILITY", service_name: "Branded Standing Display (FSDU)", package: "Basic", description: "Display for 6 months.", price_gbp: "£600", price_usd: "$800", price_eur: "€720", coverage: "Per store, 6 months" },
  { id: "s26-fixture-fsdu-premium", category: "IN-STORE VISIBILITY", service_name: "Branded Standing Display (FSDU)", package: "Premium", description: "Display for 12 months.", price_gbp: "£1,000", price_usd: "$1,265", price_eur: "€1,200", coverage: "Per store, 12 months" },

  // 3. In-store Demonstrations
  { id: "s26-demo-supplier", category: "ACTIVATION & DEMONSTRATION", service_name: "In-store Demonstration", package: "By Supplier", description: "Demonstration conducted by Supplier Agents with Longdan support for setup and operation.", price_gbp: "£55", price_usd: "$69", price_eur: "€70", coverage: "Per 3–4 hour demo session/store" },
  { id: "s26-demo-longdan", category: "ACTIVATION & DEMONSTRATION", service_name: "In-store Demonstration", package: "By Longdan Staff", description: "Demonstration conducted entirely by Longdan staff, including setup and operation. Applicable only for snacks and drinks; excludes products requiring cooking or containing alcohol.", price_gbp: "£195", price_usd: "$245", price_eur: "€235", coverage: "Per 3–4 hour demo session/store" },
  { id: "s26-demo-licensed", category: "ACTIVATION & DEMONSTRATION", service_name: "In-store Demonstration", package: "By Licensed Agent", description: "Demonstration conducted by a licensed agent with Longdan support for setup and operation.", price_gbp: "£265", price_usd: "$335", price_eur: "€320", coverage: "Per 3–4 hour demo session/store" },

  // 4. Digital (2026)
  { id: "s26-digital-landing", category: "DIGITAL MARKETING", service_name: "Landing Page", description: "Website banner, email, and social media promotion, dedicated landing page, and SEO support.", price_gbp: "£1,200", price_usd: "$1,500", price_eur: "€1,440", coverage: "per page" },
  { id: "s26-digital-livestream", category: "DIGITAL MARKETING", service_name: "Livestream", description: "A dedicated brand spotlight during livestream sessions, including host-led promotion and trade incentives.", price_gbp: "£400", price_usd: "$500", price_eur: "€480", coverage: "Per session, aligned with the number of campaigns the supplier participates in." },
  { id: "s26-digital-email", category: "DIGITAL MARKETING", service_name: "Email Marketing", description: "A dedicated email campaign sent to over 45,000 Longdan Online subscribers and 2,000/1,000 Longdan Wholesale Customer emails, targeting both Retail and Wholesale audiences to promote new arrivals, key campaigns, and featured products available in-store and online.", price_gbp: "£400", price_usd: "$500", price_eur: "€480", coverage: "Per 1-month display campaign across 13 stores", notes: "Source wholesale subscriber count read as \"2,000 1,000\" — two figures run together in the supplied table. Preserved as given, flagged rather than guessed.", status: "NEEDS VERIFICATION" },
  { id: "s26-digital-tvc", category: "DIGITAL MARKETING", service_name: "TVC", description: "A dedicated in-store TVC campaign featuring supplier-provided videos displayed across 53 digital screens in 13 Longdan stores, helping maximise product visibility and customer awareness during the campaign period.", price_gbp: "£400", price_usd: "$500", price_eur: "€480", coverage: "Per 1-month display campaign across 13 stores" },
];

const COVERAGE_TERMS_2027: { term_type: string; values: string[] }[] = [
  { term_type: "Duration", values: ["1 session", "2 weeks", "1 month", "3 months", "6 months", "12 months"] },
  { term_type: "Store Coverage", values: ["1 store", "Selected stores", "All 13 stores"] },
  { term_type: "Channel / Market", values: ["Retail", "Online", "Wholesale", "Retail + Online", "Retail + Wholesale + Online"] },
  { term_type: "Frequency", values: ["One-off", "Monthly", "Seasonal", "Annual"] },
];

interface CampaignTypeSeed {
  id: string;
  name: string;
  what_it_is: string;
  frequency: string;
  timing_rule: string;
  duration: string;
  purpose: string;
  typical_deliverables: string;
  notes?: string | null;
  explanation_vi: string;
  status?: "CURRENT" | "NEEDS VERIFICATION";
}

const CAMPAIGN_TYPES: CampaignTypeSeed[] = [
  { id: "ct-monthly", name: "Monthly Campaign", what_it_is: "Recurring monthly brand/product campaign across Longdan retail (and online where applicable).", frequency: "12 per year", timing_rule: "One per calendar month", duration: "4 weeks (per rate card)", purpose: "Drive consistent monthly visibility and sales momentum for participating brands.", typical_deliverables: "A4 poster, wobbler, price strip, website banner, email, social media", notes: "See Premium Campaign — Monthly Campaign (2027) / Premium listing (2026) for current rate.", explanation_vi: "Chiến dịch lặp lại mỗi tháng, 12 lần/năm." },
  { id: "ct-golden-week", name: "Golden Week", what_it_is: "Dedicated flagship activation window.", frequency: "6 per year, per the annual campaign calendar", timing_rule: "Per the annual campaign calendar — \"Week\" does not automatically mean 7 calendar days; always use the defined campaign Start/End dates.", duration: "2 weeks (per rate card)", purpose: "Flagship seasonal/thematic activation with amplified POSM and digital support.", typical_deliverables: "A4 poster, wobbler, website banner, email, social media", notes: "Listing Marketing Campaigns — Basic (2026) and Essential Campaign — Golden Weeks (2027) are the corresponding rate card entries. CONFLICT: the Longdan 2026 Marketing Execution Plan (supplied 2026-10-04) lists Golden Week Execution as 7x/year in its Retail Marketing execution overview — not reconciled with the 6/year rule here. Verify which figure is current before planning next year's calendar.", explanation_vi: "Chiến dịch trọng điểm 6 lần/năm theo Annual Campaign Calendar.", status: "NEEDS VERIFICATION" },
  { id: "ct-branded-week", name: "Branded Week", what_it_is: "Alternative branded activation used in months that are not a Golden Week month.", frequency: "Fills the non-Golden-Week months of the year", timing_rule: "Scheduled opposite Golden Week in the annual calendar — use the defined campaign dates, not a literal 7-day assumption.", duration: "Per the annual campaign calendar", purpose: "Maintains a consistent cadence of flagship-style activation across all months, not only Golden Week months.", typical_deliverables: "POSM + digital, brand-led (similar structure to Golden Week)", explanation_vi: "Hoạt động thương hiệu thay thế ở các tháng không có Golden Week." },
  { id: "ct-double-date", name: "Double Date", what_it_is: "Shopping-event campaign tied to a calendar double-date (e.g. 10.10, 11.11).", frequency: "Per the annual campaign calendar", timing_rule: "Aligned to the specific double-date", duration: "Short, date-anchored window", purpose: "Capture seasonal shopping-event demand.", typical_deliverables: "Campaign creative (TVC/banner/social), in-store promotion support", explanation_vi: "Chiến dịch mua sắm theo ngày đôi (vd 10.10, 11.11), chạy theo ngày cụ thể, không cố định tuần." },
  { id: "ct-longdan-plus", name: "Longdan Plus", what_it_is: "Longdan's loyalty/membership-linked promotion mechanic.", frequency: "Per campaign calendar / as scheduled", timing_rule: "Per campaign dates", duration: "Per campaign dates", purpose: "Drive loyalty member engagement and registration.", typical_deliverables: "Membership card / QR code creative, in-store promotion signage", notes: "See execution records such as LP-Oct26 for a live example.", explanation_vi: "Cơ chế khuyến mãi gắn với thẻ thành viên/loyalty của Longdan." },
  { id: "ct-clearance", name: "Clearance Sale", what_it_is: "Stock clearance / markdown promotion.", frequency: "As needed", timing_rule: "Per clearance period dates", duration: "Variable", purpose: "Move aged or excess stock.", typical_deliverables: "Price label / promotion tag", explanation_vi: "Chương trình xả hàng tồn/giảm giá, chạy khi cần, không theo lịch cố định." },
  { id: "ct-weekly-exceptional", name: "Weekly / Exceptional", what_it_is: "Ad-hoc or exceptional short-run promotion outside the standard campaign cadence.", frequency: "As needed", timing_rule: "Per specific dates", duration: "Typically 1 week or less", purpose: "React to short-term commercial opportunities.", typical_deliverables: "Varies by occasion", explanation_vi: "Khuyến mãi ngắn hạn, phát sinh ngoài lịch chiến dịch chuẩn." },
  { id: "ct-volume-category", name: "Volume / Category Deal", what_it_is: "Bulk/volume pricing deal, often by product category.", frequency: "As scheduled", timing_rule: "Per deal dates", duration: "Variable", purpose: "Drive case/bulk volume and wholesale demand.", typical_deliverables: "Price label, wholesale promotion signage", explanation_vi: "Ưu đãi theo số lượng/ngành hàng, thường áp dụng cho kênh wholesale." },
  { id: "ct-social-email", name: "Social / Email support", what_it_is: "Digital amplification layer (social media + email) that supports any of the campaign types above.", frequency: "Per campaign", timing_rule: "Aligned to the parent campaign's dates", duration: "Aligned to the parent campaign", purpose: "Extend campaign reach beyond in-store.", typical_deliverables: "Social post/story, email/eNews send", notes: "Not a standalone campaign type — always linked to a parent Campaign/Activity, per the Month → Brand → Activity → Asset hierarchy.", explanation_vi: "Lớp khuếch đại digital (social + email) đi kèm một chiến dịch gốc, không đứng độc lập." },
];

const AP_PLAYBOOK_STEPS: { id: string; step_order: number; step_name: string; description: string; description_vi: string; rules: string | null }[] = [
  { id: "ap-step-brief", step_order: 1, step_name: "Brief", description: "Capture the supplier's ask — scope, objective, budget range, timing.", description_vi: "Ghi nhận yêu cầu của nhà cung cấp — phạm vi, mục tiêu, ngân sách, thời gian.", rules: null },
  { id: "ap-step-verify", step_order: 2, step_name: "Verify Data", description: "Confirm the underlying commercial data before building anything.", description_vi: "Xác minh dữ liệu thương mại gốc trước khi xây dựng bất kỳ nội dung nào.", rules: "Use actual sales/product codes, not estimates.\nVerify campaign name, dates, package rights and totals before proceeding." },
  { id: "ap-step-select", step_order: 3, step_name: "Select Activities", description: "Choose services/activities from the current rate card that match the brief.", description_vi: "Chọn dịch vụ/hoạt động từ rate card hiện hành phù hợp với yêu cầu.", rules: "Reference Master → Services & Rate Card for current pricing — never quote from memory or a stale sheet." },
  { id: "ap-step-budget", step_order: 4, step_name: "Build Budget", description: "Build the budget from actual PO references and the contribution split.", description_vi: "Xây ngân sách từ PO thực tế và tỷ lệ đóng góp của hai bên.", rules: "Distinguish Supplier contribution vs Longdan contribution.\nBuild the budget from PO-based references, not assumptions.\nTarget cost, proposed cost and confirmed budget are three different numbers — never conflate them." },
  { id: "ap-step-forecast", step_order: 5, step_name: "Forecast", description: "Forecast expected performance from real baseline data.", description_vi: "Dự báo hiệu quả dựa trên baseline thực tế, không dùng giả định lạc quan.", rules: "Forecast from actual baseline sales, not optimistic assumptions.\nUse 2–3x baseline uplift only where explicitly instructed — never as a default assumption.\nMock-up data must never be presented as evidence." },
  { id: "ap-step-build", step_order: 6, step_name: "Build Proposal", description: "Assemble the proposal document from verified inputs.", description_vi: "Soạn đề xuất từ các dữ liệu đã được xác minh.", rules: "Do not invent market or brand claims not backed by data." },
  { id: "ap-step-qa", step_order: 7, step_name: "Final QA", description: "Final check before sending.", description_vi: "Kiểm tra lần cuối trước khi gửi — tên chiến dịch, ngày, quyền lợi gói, tổng số liệu.", rules: "Verify campaign name, dates, package rights and totals before sending.\nConfirm the Supplier vs Longdan contribution split is correct.\nConfirm all figures trace back to PO/actuals, not placeholders." },
];

const AP_CHECKLIST: string[] = [
  "Campaign name, dates and package rights verified",
  "Supplier contribution vs Longdan contribution confirmed",
  "Budget figures trace to PO references, not assumptions",
  "Target cost / proposed cost / confirmed budget not conflated",
  "Forecast built from actual baseline sales",
  "2–3x baseline uplift used only where explicitly instructed",
  "No mock-up data presented as evidence",
  "No invented market or brand claims",
  "All totals verified before sending",
];

// Categories consolidated to the 6 SOP buckets shown after the 4 team
// workstreams on the Operations page: Design Rules / Reporting / Demo / A&P /
// POSM / Other SOP (the remaining channel-specific workflows).
const HANDBOOK_ENTRIES: { id: string; category: string; title: string; body: string; body_vi?: string; summary_vi: string; source: string; status: "CURRENT" | "NEEDS VERIFICATION" }[] = [
  {
    id: "hb-design-brief-rules",
    category: "Design Rules",
    title: "Reading a Design Brief as a hierarchy",
    body: "Design Briefs are read as a hierarchy: Month → Campaign/Activity → Brand → Asset → Variant/Product Group → Product/SKU → Promotion → Design Instructions. Blank cells inherit the parent block's context — never treated as missing data on their own.\n\nKey separations:\n— Activity ≠ Asset. Activity Type → Activity → Asset Type (e.g. Brand Dongwon, Activity \"In-store Promotion\", Assets Wobbler + Shelf Strip).\n— Variant must be a real creative/product variant (e.g. \"Soju\", \"Kimchi\"), never an instruction (\"1 design only\", \"Add KFood logo\") — instructions are stored as Design Note.\n— Category is only trusted from Shelf Strip/Wobbler asset types — the same free-text field means something different on an Email/eNews asset (a product name, not a category).\n— A Portfolio/Supplier name (e.g. \"KFood\") is never created as a Brand.\n— Brand is inferred from a product-name prefix only when every SKU on the asset shares the same prefix — never guessed from one ambiguous product.\n\nWhen the source genuinely lacks enough context to resolve a field, mark NEEDS MAPPING — never invent.",
    body_vi: "Design Brief được đọc theo cấp bậc: Month → Campaign/Activity → Brand → Asset → Variant/Product Group → Product/SKU → Promotion → Design Instructions. Ô trống kế thừa ngữ cảnh của khối cha — không coi là thiếu dữ liệu.\n\nCác phân tách quan trọng:\n— Activity ≠ Asset. Activity Type → Activity → Asset Type (vd: Brand Dongwon, Activity \"In-store Promotion\", Asset Wobbler + Shelf Strip).\n— Variant phải là biến thể sáng tạo/sản phẩm thật (vd \"Soju\", \"Kimchi\"), không phải hướng dẫn (\"1 design only\", \"Add KFood logo\") — hướng dẫn được lưu vào Design Note.\n— Category chỉ tin cậy từ asset type Shelf Strip/Wobbler — cùng field tự do có thể mang nghĩa khác trên asset Email/eNews (tên sản phẩm, không phải category).\n— Tên Portfolio/Supplier (vd \"KFood\") không bao giờ được tạo thành Brand.\n— Brand được suy ra từ tiền tố tên sản phẩm chỉ khi mọi SKU trên asset có cùng tiền tố — không đoán từ một sản phẩm mơ hồ.\n\nKhi nguồn thực sự không đủ ngữ cảnh để xác định field, đánh dấu NEEDS MAPPING — không tự bịa.",
    summary_vi: "Quy tắc đọc Design Brief theo cấp bậc Month → Activity → Brand → Asset → Variant → SKU, không tự suy đoán khi thiếu dữ liệu.",
    source: "Design Assets & Master Data Update spec, implemented in designBrief.ts / designBriefImport.ts",
    status: "CURRENT",
  },
  {
    id: "hb-reporting-standards",
    category: "Reporting",
    title: "Weekly Demo report format",
    body: "Executive summaries are short — 3–4 bullets (Performance / Best / Issue / Takeaway), 50–70 words max, generated from calculated metrics (units sold, uplift, FOC, CVS rate), never copied verbatim from the narrative report.\n\nStart/Stop/Continue actions are ONE sentence each, in the form Brand + Store/SKU/Promotion + Action, max ~15–20 words — never a copied report paragraph.\n\nAll calculated metrics (uplift, FOC efficiency, CVS variance) are computed at read-time from session-level data, never stored as pre-baked numbers, so they can never drift from the underlying records.",
    body_vi: "Executive summary ngắn gọn — 3–4 gạch đầu dòng (Performance / Best / Issue / Takeaway), tối đa 50–70 từ, tạo ra từ số liệu đã tính toán (units sold, uplift, FOC, CVS rate), không copy nguyên văn từ báo cáo tường thuật.\n\nHành động Start/Stop/Continue mỗi câu MỘT dòng, theo cấu trúc Brand + Store/SKU/Promotion + Action, tối đa ~15–20 từ — không phải đoạn văn copy từ báo cáo.\n\nTất cả số liệu tính toán (uplift, hiệu quả FOC, chênh lệch CVS) được tính tại thời điểm đọc dữ liệu từ cấp session, không lưu sẵn số liệu cố định, nên không bao giờ lệch khỏi dữ liệu gốc.",
    summary_vi: "Chuẩn báo cáo Demo hàng tuần: tóm tắt ngắn 3–4 gạch đầu dòng, hành động Start/Stop/Continue mỗi câu 1 dòng.",
    source: "Demo Reporting & Brand Performance spec",
    status: "CURRENT",
  },
  { id: "hb-demo", category: "Demo", title: "Demo session tracking", body: "Demo/Tasting sessions are tracked per-week in demo_weekly_reports / demo_session_performance, with rates defined in Master → Services & Rate Card (Activation & Demonstration). Detailed day-of-session operating procedure not yet documented.", body_vi: "Buổi Demo/Tasting được theo dõi theo tuần trong demo_weekly_reports / demo_session_performance, giá tham khảo tại Master → Services & Rate Card (Activation & Demonstration). Quy trình vận hành chi tiết trong ngày demo chưa được ghi lại.", summary_vi: "Buổi Demo theo dõi theo tuần, giá tham khảo tại Master → Rate Card — quy trình vận hành chi tiết chưa có.", source: "Inferred from demo reporting schema", status: "NEEDS VERIFICATION" },
  { id: "hb-ap-reporting", category: "A&P", title: "Agreed vs Delivered tracking", body: "A&P tracks Agreed → Delivered → Evidence → Reported, pulling actual execution from Campaign/In-store/Demo/Digital/Promotion/Design Assets rather than duplicating execution records inside A&P. See Master → A&P Proposal Playbook for the proposal-building process. Post-campaign reporting cadence not yet documented.", body_vi: "A&P theo dõi Agreed → Delivered → Evidence → Reported, lấy dữ liệu thực thi từ Campaign/In-store/Demo/Digital/Promotion/Design Assets thay vì tạo bản ghi thực thi trùng trong A&P. Xem Master → A&P Proposal Playbook để biết quy trình xây đề xuất. Nhịp báo cáo sau chiến dịch chưa được ghi lại.", summary_vi: "A&P theo dõi Agreed → Delivered → Evidence → Reported, lấy dữ liệu từ các module khác, không tạo bản ghi trùng.", source: "Inferred from ap_packages / ap_delivery_lines schema", status: "NEEDS VERIFICATION" },
  { id: "hb-posm", category: "POSM", title: "POSM material handling", body: "POSM materials (Wobbler, Shelf Strip, FSDU, Branded Gondola/Fridge/Freezer) are supplier-provided per the Services & Rate Card; Longdan coordinates planning, store communication, distribution and execution (see POSM Campaign Support service). Detailed internal handling steps not yet documented.", body_vi: "Vật phẩm POSM (Wobbler, Shelf Strip, FSDU, Branded Gondola/Fridge/Freezer) do nhà cung cấp cấp theo Services & Rate Card; Longdan điều phối lên kế hoạch, thông báo cửa hàng, phân phối và thực thi (xem dịch vụ POSM Campaign Support). Các bước xử lý nội bộ chi tiết chưa được ghi lại.", summary_vi: "Vật phẩm POSM do nhà cung cấp cấp, Longdan điều phối lắp đặt — quy trình nội bộ chi tiết chưa có.", source: "Inferred from Services & Rate Card", status: "NEEDS VERIFICATION" },
  { id: "hb-instore", category: "Other SOP", title: "In-store activity tracking", body: "In-store activity (Promotion, Fixture/Branding, POSM) is tracked as Design Activities of type IN-STORE, linked to the same Brand/Month/Asset records shown in Design Assets and the In-store module. Detailed step-by-step execution workflow (store comms, installation, removal) not yet documented — add via Master when available.", body_vi: "Hoạt động in-store (Promotion, Fixture/Branding, POSM) được theo dõi dưới dạng Design Activities loại IN-STORE, liên kết với cùng bản ghi Brand/Month/Asset hiển thị ở Design Assets và module In-store. Quy trình thực thi chi tiết từng bước (thông báo cửa hàng, lắp đặt, tháo dỡ) chưa được ghi lại — sẽ bổ sung vào Master khi có.", summary_vi: "Hoạt động in-store (Promotion, Fixture/Branding, POSM) theo dõi qua Design Activities — quy trình chi tiết chưa có.", source: "Inferred from design_activities schema", status: "NEEDS VERIFICATION" },
  { id: "hb-tvc", category: "Other SOP", title: "TVC asset tracking", body: "In-store TVC and TVC-type Design Assets are tracked under channel DIGITAL / IN-STORE SCREEN, displayed across Longdan's digital screens (53 screens / 13 stores per the rate card). Submission/encoding/scheduling steps not yet documented.", body_vi: "TVC tại cửa hàng và Design Asset loại TVC được theo dõi dưới kênh DIGITAL / IN-STORE SCREEN, hiển thị trên màn hình số của Longdan (53 màn/13 cửa hàng theo rate card). Các bước nộp bài/encode/lên lịch chưa được ghi lại.", summary_vi: "TVC cửa hàng hiển thị trên màn hình số (53 màn/13 cửa hàng) — quy trình nộp bài/lên lịch chưa có.", source: "Inferred from design_assets schema + Services & Rate Card", status: "NEEDS VERIFICATION" },
  { id: "hb-digital", category: "Other SOP", title: "Digital asset channels", body: "Digital Design Assets split into Social, Website, Email/eNews and Video — each mapped to its own channel in design_assets.channel. Rates and coverage are defined in Master → Services & Rate Card (Digital Marketing). Publishing/scheduling procedure not yet documented.", body_vi: "Design Asset Digital chia thành Social, Website, Email/eNews và Video — mỗi loại gắn với kênh riêng trong design_assets.channel. Giá và phạm vi được định nghĩa tại Master → Services & Rate Card (Digital Marketing). Quy trình đăng bài/lên lịch chưa được ghi lại.", summary_vi: "Tài sản Digital chia theo kênh Social/Website/Email/Video — quy trình đăng bài/lên lịch chưa có.", source: "Inferred from design_assets schema", status: "NEEDS VERIFICATION" },
  { id: "hb-email", category: "Other SOP", title: "Email / eNews assets", body: "Email/eNews assets map to channel EMAIL, reaching Longdan's Retail and Wholesale subscriber base per the rate card. Build/send/approval procedure not yet documented.", body_vi: "Tài sản Email/eNews gắn với kênh EMAIL, tiếp cận khách Retail và Wholesale của Longdan theo rate card. Quy trình build/gửi/duyệt chưa được ghi lại.", summary_vi: "Email/eNews gửi tới khách Retail và Wholesale — quy trình duyệt/gửi chưa có.", source: "Inferred from design_assets schema", status: "NEEDS VERIFICATION" },
  { id: "hb-website", category: "Other SOP", title: "Website assets", body: "Website assets (Banner — Desktop/Mobile, Landing Page) map to channel WEBSITE. Build/publish procedure not yet documented.", body_vi: "Tài sản Website (Banner — Desktop/Mobile, Landing Page) gắn với kênh WEBSITE. Quy trình build/publish chưa được ghi lại.", summary_vi: "Tài sản Website (Banner, Landing Page) — quy trình build/publish chưa có.", source: "Inferred from design_assets schema", status: "NEEDS VERIFICATION" },
  { id: "hb-promotion", category: "Other SOP", title: "Channel-specific promotions", body: "Promotions remain channel-specific (In-store / Retail Online / Wholesale / Last Mile) and are never merged across channels even for the same SKU — see promotions.channel and the Design Assets promotion cross-link logic. Approval procedure not yet documented.", body_vi: "Khuyến mãi luôn tách riêng theo kênh (In-store / Retail Online / Wholesale / Last Mile) và không bao giờ gộp chung dù cùng SKU — xem promotions.channel và logic liên kết khuyến mãi ở Design Assets. Quy trình duyệt chưa được ghi lại.", summary_vi: "Khuyến mãi luôn tách riêng theo kênh (In-store/Online Retail/Wholesale/Last Mile), không gộp chung dù cùng SKU.", source: "Inferred from promotions schema", status: "NEEDS VERIFICATION" },
  {
    id: "hb-systems-architecture",
    category: "Other SOP",
    title: "Database, Systems & Data Flow",
    body: "SAP Business One is the master data source (purchasing, warehouse, sales, finance, inventory — owned by WH/Purchasing/Sales/Finance/IT). Longdan ePOS handles retail sales, promotions, loyalty and store operations (Retail/Marketing/IT). The POSM & TVC Dashboard tracks POSM allocation and TVC scheduling (Marketing & IT). Power BI + other reports cover business performance, marketing reporting and KPI dashboards (IT & BI Team).\n\nData Flow: SAP Business One → ePOS → Power BI → Marketing & Business Reporting.",
    body_vi: "SAP Business One là nguồn dữ liệu gốc (purchasing, kho, sales, tài chính, tồn kho — thuộc sở hữu của WH/Purchasing/Sales/Finance/IT). Longdan ePOS xử lý doanh số retail, khuyến mãi, loyalty và vận hành cửa hàng (Retail/Marketing/IT). POSM & TVC Dashboard theo dõi phân bổ POSM và lịch TVC (Marketing & IT). Power BI + các báo cáo khác bao gồm hiệu quả kinh doanh, báo cáo marketing và dashboard KPI (IT & BI Team).\n\nLuồng dữ liệu: SAP Business One → ePOS → Power BI → Báo cáo Marketing & Kinh doanh.",
    summary_vi: "SAP Business One là nguồn dữ liệu gốc; dữ liệu chảy qua ePOS rồi lên Power BI để phục vụ báo cáo Marketing.",
    source: "Marketing Execution Induction — Databased and System and Business Model — supplied 2026-10-03",
    status: "CURRENT",
  },
  {
    id: "hb-business-model",
    category: "Other SOP",
    title: "Longdan Business Model — Core Channels",
    body: "Retail: 13 Longdan stores, Longdan.co.uk, Kimson.co.uk, Uber Eats, Just Eat & Deliveroo (owned by Retail Operations).\nWholesale: B2B sales, Wholesale Shop, Online Wholesale (Sales Team & Shop Leaders).\nMarketing & A&P: campaigns, supplier partnerships, A&P investment and brand growth (Marketing).\nOEM & Product Development: private-label brands including Sarap Kitchen OEM and new product launches (Marketing & Purchasing).\n\nChannel integration by campaign type (Loyalty/WS, Ecommerce, In-store, Social, Email — all ✓ unless noted): Monthly Campaign, Golden Weeks, Clearance Sales and eNewsletter run across all 5 channels. Longdan Plus excludes Ecommerce. Double Date excludes Loyalty/WS and In-store. Black Friday runs across all 5 channels.",
    body_vi: "Retail: 13 cửa hàng Longdan, Longdan.co.uk, Kimson.co.uk, Uber Eats, Just Eat & Deliveroo (thuộc Retail Operations).\nWholesale: bán B2B, Wholesale Shop, Online Wholesale (Sales Team & Shop Leaders).\nMarketing & A&P: chiến dịch, hợp tác nhà cung cấp, đầu tư A&P và phát triển thương hiệu (Marketing).\nOEM & Product Development: thương hiệu riêng gồm Sarap Kitchen OEM và sản phẩm mới (Marketing & Purchasing).\n\nTích hợp kênh theo loại chiến dịch (Loyalty/WS, Ecommerce, In-store, Social, Email — tất cả ✓ trừ khi ghi chú): Monthly Campaign, Golden Weeks, Clearance Sales và eNewsletter chạy trên cả 5 kênh. Longdan Plus không có Ecommerce. Double Date không có Loyalty/WS và In-store. Black Friday chạy trên cả 5 kênh.",
    summary_vi: "Longdan có 4 mảng kinh doanh chính: Retail, Wholesale, Marketing & A&P, và OEM/Product Development.",
    source: "Marketing Execution Induction — Longdan Business Model — supplied 2026-10-03",
    status: "CURRENT",
  },
];

interface WorkstreamSeed {
  id: string;
  pic_name: string;
  recurring_tasks: string | null;
  recurring_tasks_vi?: string | null;
  weekly_timing: string | null;
  weekly_timing_vi?: string | null;
  input_needed: string | null;
  input_needed_vi?: string | null;
  my_action: string | null;
  my_action_vi?: string | null;
  handover_to: string | null;
  handover_to_vi?: string | null;
  deadline: string | null;
  deadline_vi?: string | null;
  output: string | null;
  output_vi?: string | null;
  check_audit: string | null;
  check_audit_vi?: string | null;
  important_rules: string | null;
  important_rules_vi?: string | null;
  execution_detail?: string | null;
  execution_detail_vi?: string | null;
  status: "CURRENT" | "NEEDS VERIFICATION";
  source: string | null;
}

// The 4 core execution workstreams (Retail Marketing, POSM/Demo/TVC, Digital
// Marketing, A&P), plus the Operation Marketing & Project Management role that
// coordinates across all 4 — from the Marketing Execution Induction document
// (supplied 2026-10-03). The canonical weekly cadence is the consolidated
// "Core Marketing Activities Timetable" at the end of that document (one task
// per day); the earlier narrative "Example Weekly Workflow" in the Retail
// induction section describes the same role at a different level of detail,
// not a conflicting timeline — folded into recurring_tasks as elaboration.
const WORKSTREAMS: WorkstreamSeed[] = [
  {
    id: "ws-instore",
    pic_name: "Retail Marketing (In-store)",
    recurring_tasks:
      "Bridges marketing strategy with store-level execution via the ePOS platform: promotion setup/maintenance, container-driven campaign master file (3–4 weeks before container arrival), stock clearance strategy (6–9 month BBD items), cross-team coordination with product owners, purchasing and digital marketing.",
    recurring_tasks_vi:
      "Kết nối chiến lược marketing với thực thi tại cửa hàng qua nền tảng ePOS: setup/duy trì khuyến mãi, file tổng chiến dịch theo container (3–4 tuần trước khi container về), chiến lược xả hàng tồn (hàng 6–9 tháng BBD), phối hợp liên nhóm với product owner, purchasing và digital marketing.",
    weekly_timing:
      "Mon → Promotion Preparation — review Demo FOC records, verify required quantities, chase stakeholders to complete Marketing Promotion Forms\nTue → Promotion List Review — check, consolidate and confirm the weekly promotion list (products, mechanics, stores, timelines)\nWed → Promotion Setup — recommend, coordinate and process approved promotions on ePOS and retail systems\nThu → Setup Audit — check promotion setup accuracy, pricing, mechanics and store execution; resolve issues\nFri → Campaign Launch & Previous Campaign Audit — announce upcoming launches; audit the previous promotion for completion and issues",
    weekly_timing_vi:
      "T2 → Chuẩn bị khuyến mãi — xem lại hồ sơ FOC của Demo, xác nhận số lượng cần thiết, nhắc các bên liên quan hoàn thành Marketing Promotion Forms\nT3 → Review danh sách khuyến mãi — kiểm tra, tổng hợp và chốt danh sách khuyến mãi tuần (sản phẩm, cơ chế, cửa hàng, thời gian)\nT4 → Setup khuyến mãi — đề xuất, phối hợp và xử lý khuyến mãi đã duyệt trên ePOS và hệ thống retail\nT5 → Audit setup — kiểm tra độ chính xác setup, giá, cơ chế và thực thi tại cửa hàng; xử lý sự cố\nT6 → Launch chiến dịch & Audit chiến dịch trước — thông báo launch sắp tới; audit khuyến mãi trước đó để kiểm tra hoàn thành và sự cố",
    input_needed: "Marketing Promotion Forms from product owners; Demo FOC records; container arrival schedule; warehouse BBD/stock data (6–9 months).",
    input_needed_vi: "Marketing Promotion Forms từ product owner; hồ sơ FOC của Demo; lịch container về; dữ liệu tồn kho/BBD kho (6–9 tháng).",
    my_action: "Prepare → Review → Coordinate → Setup → Audit → Launch → Improve.",
    my_action_vi: "Chuẩn bị → Review → Phối hợp → Setup → Audit → Launch → Cải thiện.",
    handover_to: "Store teams (promotion instructions, signage), POSM team (merchandising alignment), UK Audit Team (compliance review), product owners (rule guidance).",
    handover_to_vi: "Team cửa hàng (hướng dẫn khuyến mãi, biển hiệu), team POSM (căn chỉnh trưng bày), UK Audit Team (kiểm tra tuân thủ), product owner (hướng dẫn quy tắc).",
    deadline: "Campaign master file: 3–4 weeks before container arrival. Monthly Campaign / Golden Week / Clearance / Longdan Plus submission: 2–3 weeks prior to start (Tue). Weekly/Exceptional & Volume/Category Deal requests: Tue 8PM VN time.",
    deadline_vi: "File tổng chiến dịch: 3–4 tuần trước khi container về. Nộp Monthly Campaign / Golden Week / Clearance / Longdan Plus: 2–3 tuần trước ngày bắt đầu (Thứ 3). Yêu cầu Weekly/Exceptional & Volume/Category Deal: Thứ 3 8 giờ tối giờ VN.",
    output: "Live, correctly-priced promotions on ePOS across all stores; container-driven campaign master file; clearance promotion plan; weekly activation summary to Retail Operations.",
    output_vi: "Khuyến mãi live, đúng giá trên ePOS tại tất cả cửa hàng; file tổng chiến dịch theo container; kế hoạch xả hàng; tóm tắt hoạt động hàng tuần gửi Retail Operations.",
    check_audit: "Weekly live-promotion review (Mon); UK Audit Team field audits; store manager/staff feedback loop resolved promptly.",
    check_audit_vi: "Review khuyến mãi đang chạy hàng tuần (T2); UK Audit Team kiểm tra thực địa; phản hồi từ quản lý/nhân viên cửa hàng được xử lý kịp thời.",
    important_rules:
      "Apply internal discount-limit / combination / category-overlap rules before setup — advise product owners accordingly. Cross-check SKUs, dates and discount structure before go-live. Success = all live promotions correctly set up and visible store-wide, 100% audit compliance on signage/execution, feedback loops resolved promptly.",
    important_rules_vi:
      "Áp dụng quy tắc giới hạn giảm giá / kết hợp / chồng chéo ngành hàng trước khi setup — tư vấn lại cho product owner. Kiểm tra chéo SKU, ngày tháng và cơ cấu giảm giá trước khi go-live. Thành công = tất cả khuyến mãi đang chạy được setup đúng và hiển thị toàn hệ thống cửa hàng, 100% tuân thủ audit về biển hiệu/thực thi, phản hồi được xử lý kịp thời.",
    execution_detail:
      "Focus areas: campaign-themed merchandising, Golden Week/seasonal displays, clearance & flash sale support, in-store promotion audit & compliance, staff training.\n\n" +
      "Execution overview:\n" +
      "— Themed Campaign Displays — Monthly — LNY, Chuseok, Summer BBQ, Halloween\n" +
      "— Golden Week Execution — 7x/year per this execution plan (see Note) — high-impact displays, demo tie-ins\n" +
      "— Clearance Sales (CS) — 5x/year — planograms updated, signage refreshed\n" +
      "— In-store Promotion Audit — Weekly — verify POSM placement and pricing\n" +
      "— Black Friday Rollout — November — dedicated sections, demo focus, gifting zones\n" +
      "— Staff Training Materials — Monthly — cultural insights, promo mechanics\n" +
      "— Local Store Feedback Loop — Ongoing\n\n" +
      "Note: this plan lists Golden Week at 7x/year, which conflicts with the 6/year rule in Master → Campaign Knowledge → Golden Week. Not reconciled — see that entry's Needs Verification flag.\n\n" +
      "Supporting tools: Demo coordination (live cooking/tasting), POSM toolkits (refreshed weekly per campaign), In-store TVC screens (rotating loops), shared event calendars.",
    execution_detail_vi:
      "Trọng tâm: trưng bày theo chủ đề chiến dịch, trưng bày Golden Week/theo mùa, hỗ trợ xả hàng & flash sale, audit & tuân thủ khuyến mãi tại cửa hàng, đào tạo nhân viên.\n\n" +
      "Tổng quan thực thi:\n" +
      "— Trưng bày theo chủ đề chiến dịch — Hàng tháng — LNY, Chuseok, Summer BBQ, Halloween\n" +
      "— Golden Week Execution — 7 lần/năm theo kế hoạch này (xem Ghi chú) — trưng bày tác động cao, kết hợp demo\n" +
      "— Clearance Sales (CS) — 5 lần/năm — cập nhật planogram, làm mới biển hiệu\n" +
      "— Audit khuyến mãi tại cửa hàng — Hàng tuần — kiểm tra vị trí POSM và giá\n" +
      "— Black Friday Rollout — Tháng 11 — khu vực riêng, tập trung demo, khu quà tặng\n" +
      "— Tài liệu đào tạo nhân viên — Hàng tháng — hiểu biết văn hóa, cơ chế khuyến mãi\n" +
      "— Vòng phản hồi cửa hàng địa phương — Liên tục\n\n" +
      "Ghi chú: kế hoạch này ghi Golden Week là 7 lần/năm, mâu thuẫn với rule 6 lần/năm ở Master → Campaign Knowledge → Golden Week. Chưa được đối chiếu — xem cờ Needs Verification ở mục đó.\n\n" +
      "Công cụ hỗ trợ: điều phối Demo (nấu/nếm trực tiếp), bộ công cụ POSM (làm mới hàng tuần theo chiến dịch), màn hình TVC tại cửa hàng (video xoay vòng), lịch sự kiện dùng chung.",
    status: "CURRENT",
    source: "Marketing Execution Induction + Longdan 2026 Marketing Execution Plan — supplied 2026-10-03 / 2026-10-04",
  },
  {
    id: "ws-posm-demo-tvc",
    pic_name: "In-store — TVC / Demo / POSM",
    recurring_tasks:
      "Runs the weekly cycle for in-store TVC, Demo and POSM — balancing previous-week audits with next-week preparation across VN design/production and UK store execution. Long-term planning (LEO, Demo Plan, Design Brief) is locked in the 2nd week of the prior month.",
    recurring_tasks_vi:
      "Vận hành chu kỳ hàng tuần cho TVC, Demo và POSM tại cửa hàng — cân bằng giữa audit tuần trước và chuẩn bị tuần sau, xuyên suốt từ thiết kế/sản xuất VN đến thực thi tại cửa hàng UK. Kế hoạch dài hạn (LEO, Demo Plan, Design Brief) chốt vào tuần 2 của tháng trước.",
    weekly_timing:
      "Mon → POSM Display audit for last week + Demo planning for this week\nTue → TVC request sent to VN Office + Design brief + POSM Display audit\nWed → Set up TVC + publish TVC display on UK channel + POSM fee request/review/approval + Agency booking\nThu → Check POSM audit, prepare POSM display guideline, pack POSM. Dispatch odd-week POSM for even-week display (see POSM Odd/Even Week Logistics Rule)\nFri → Prepare Demo guideline + plan Demo for upcoming activities",
    weekly_timing_vi:
      "T2 → Audit POSM Display tuần trước + lên kế hoạch Demo tuần này\nT3 → Gửi yêu cầu TVC cho VN Office + Brief thiết kế + Audit POSM Display\nT4 → Set TVC + publish TVC display lên kênh UK + Yêu cầu/duyệt phí POSM + Đặt lịch Agency\nT5 → Kiểm tra audit POSM, làm guideline trưng bày POSM, đóng gói POSM. Gửi POSM tuần lẻ để trưng bày tuần chẵn (xem POSM Odd/Even Week Logistics Rule)\nT6 → Làm guideline Demo + lên kế hoạch Demo cho các hoạt động sắp tới",
    input_needed: "Approved campaign/demo calendar; design brief for MO + GW (locked Fri, 2nd week of prior month); product/stock confirmation; agency availability.",
    input_needed_vi: "Lịch campaign/demo đã duyệt; design brief cho MO + GW (chốt Thứ 6, tuần 2 tháng trước); xác nhận sản phẩm/tồn kho; lịch agency.",
    my_action: "Request → Brief → Set up/Produce → Audit → Dispatch → Guideline → Plan next.",
    my_action_vi: "Yêu cầu → Brief → Dựng/Sản xuất → Audit → Gửi hàng → Guideline → Lên kế hoạch tiếp theo.",
    handover_to: "VN Office (TVC production), Design team (brief), Agency (booking), UK stores (POSM dispatch + display guideline, Demo guideline).",
    handover_to_vi: "VN Office (sản xuất TVC), team Design (brief), Agency (đặt lịch), cửa hàng UK (gửi POSM + guideline trưng bày, guideline Demo).",
    deadline:
      "LEO: Tue, 2nd week of the prior month. Demo Plan: Wed, 2nd week of the prior month. Design Brief for MO + GW: Fri, 2nd week of the prior month. TVC + POSM image deadline: Friday. Demo image deadline: Monday. Other requests: allow 2–3 working days.",
    deadline_vi:
      "LEO: Thứ 3, tuần 2 tháng trước. Demo Plan: Thứ 4, tuần 2 tháng trước. Design Brief cho MO + GW: Thứ 6, tuần 2 tháng trước. Hạn hình ảnh TVC + POSM: Thứ 6. Hạn hình ảnh Demo: Thứ 2. Yêu cầu khác: cho phép 2–3 ngày làm việc.",
    output: "Weekly TVC content live on UK channel; weekly POSM display refresh + dispatch; weekly Demo guideline and plan for upcoming activities.",
    output_vi: "Nội dung TVC hàng tuần lên kênh UK; làm mới + gửi POSM hàng tuần; guideline và kế hoạch Demo hàng tuần cho hoạt động sắp tới.",
    check_audit: "POSM Display audit: Mon (last week) + Tue (this week). POSM fee: Wed review/approval. POSM pack/dispatch audit: Thu. TVC: live-check after Wed publish. Demo: guideline reviewed Fri.",
    check_audit_vi: "Audit POSM Display: T2 (tuần trước) + T3 (tuần này). Phí POSM: duyệt/review T4. Audit đóng gói/gửi POSM: T5. TVC: kiểm tra sau khi publish T4. Demo: review guideline T6.",
    important_rules:
      "Printed materials (POSM, Demo Tent Card and other printed assets) must be completed at least 2 weeks before campaign execution, to allow shipping time to the UK market. See the POSM Odd/Even Week Logistics Rule below for the exact dependency chain.",
    important_rules_vi:
      "Ấn phẩm in (POSM, Demo Tent Card và các ấn phẩm in khác) phải hoàn thành ít nhất 2 tuần trước khi campaign thực thi, để kịp thời gian vận chuyển sang thị trường UK. Xem POSM Odd/Even Week Logistics Rule bên dưới để biết chuỗi phụ thuộc chi tiết.",
    execution_detail:
      "POSM Odd/Even Week Logistics Rule — week parity is defined relative to the campaign calendar (e.g. W40 = even week, W41 = odd week). Rule: POSM for an odd week is dispatched on the Thursday of the preceding even week, so it is ready for display in the following even week.\n\n" +
      "The underlying logic is cross-market shipping lead time: printed materials (POSM, Demo Tent Card and other printed assets) must be completed at least 2 weeks before campaign execution to allow enough time to ship to the UK market.\n\n" +
      "This is a dependency chain, not just an odd/even label:\nCampaign Execution Date → (minimum 2 weeks before) → Printed Assets Ready → Odd-week Dispatch → Even-week Display/Execution Preparation.\n\n" +
      "If the artwork/print completion date does not meet this lead time, the task should be flagged At Risk rather than treated as a normal on-track task.",
    execution_detail_vi:
      "POSM Odd/Even Week Logistics Rule — tính chẵn/lẻ tuần được xác định theo lịch campaign (ví dụ W40 = tuần chẵn, W41 = tuần lẻ). Rule: POSM của tuần lẻ được gửi vào Thứ 5 của tuần chẵn liền trước, để sẵn sàng trưng bày vào tuần chẵn kế tiếp.\n\n" +
      "Logic phía sau là thời gian vận chuyển cross-market: ấn phẩm in (POSM, Demo Tent Card và các ấn phẩm in khác) phải hoàn thành ít nhất 2 tuần trước khi campaign thực thi để đủ thời gian gửi sang thị trường UK.\n\n" +
      "Đây là một chuỗi phụ thuộc (dependency chain), không chỉ đơn giản là nhãn chẵn/lẻ:\nCampaign Execution Date → (tối thiểu 2 tuần trước) → Printed Assets Ready → Odd-week Dispatch → Even-week Display/Execution Preparation.\n\n" +
      "Nếu ngày hoàn thành artwork/in ấn không đáp ứng thời gian chuẩn bị này, task đó nên được gắn cờ At Risk thay vì coi là task bình thường đang đúng tiến độ.",
    status: "CURRENT",
    source: "Longdan 2026 Marketing Execution Plan — In-store TVC/Demo/POSM + Long-term planning rules — supplied 2026-10-05",
  },
  {
    id: "ws-digital",
    pic_name: "Digital Marketing Execution",
    recurring_tasks:
      "Plans and executes Longdan's digital presence across Social, Website, Email, Online Promotion and Video — content planned at the start of each month, design work done mid-month (every 2 weeks), roughly 7 social posts/week, website banners refreshed weekly for Retail and Wholesale, Retail/Wholesale email sent weekly, and online/Last Mile promotions set up and audited weekly.",
    recurring_tasks_vi:
      "Lên kế hoạch và thực thi hiện diện digital của Longdan trên Social, Website, Email, Online Promotion và Video — content được lên kế hoạch đầu tháng, thiết kế thực hiện giữa tháng (mỗi 2 tuần), khoảng 7 bài Social/tuần, banner website làm mới hàng tuần cho Retail và Wholesale, email Retail/Wholesale gửi hàng tuần, và promotion online/Last Mile được setup và audit hàng tuần.",
    weekly_timing:
      "Social + Content — plan content at the start of the month; design every 2 weeks / mid-month; ~7 posts/week (Mon+Fri: Promotion, Tue+Sun: Filter/Engagement, Wed+Sat: Video, Thu: Demo). Seeding: every Friday.\n\n" +
      "Website Banners — Mon: schedule Retail banners + Tasting Event page; Mon: schedule Wholesale banners; Tue: audit Shopify backend; Fri: audit website front-end. On campaign end, the banner is hidden but must still be manually deleted afterwards.\n\n" +
      "Email Marketing — Retail: test Thu, send/audit Fri. Wholesale: test Wed, send/audit Thu. Monthly Retail/Wholesale email audit: 25th+ of the month. Email performance report: 2nd+ of the following month.\n\n" +
      "Online Promotion (Retail + Last Mile) — Retail: finalise list Tue, execute Wed, audit Shopify backend Thu, audit website front-end Fri. Last Mile: similar to Monthly Campaign — Deliveroo set up by Vinh, Hungry Panda/Uber Eats set up externally; audited 1st+ of the month.\n\n" +
      "Demo Event Page — not a standalone workstream; delivered inside Social + Website + Email.\n\n" +
      "Video Content (Branded Video / 2D Design + Motion) — confirm brand every 2 weeks on Monday; brand deadline Thursday; launch Friday; audit Fri/Sat.\n\n" +
      "Double Date — audited 1 day before DD.",
    weekly_timing_vi:
      "Social + Content — lên kế hoạch content đầu tháng; thiết kế mỗi 2 tuần / giữa tháng; khoảng 7 bài/tuần (T2+T6: Promotion, T3+CN: Filter/Engagement, T4+T7: Video, T5: Demo). Seeding: Thứ 6 hàng tuần.\n\n" +
      "Website Banner — T2: lên lịch banner Retail + trang Tasting Event; T2: lên lịch banner Wholesale; T3: audit Shopify backend; T6: audit frontend website. Khi campaign kết thúc, banner được ẩn nhưng vẫn phải xóa thủ công sau đó.\n\n" +
      "Email Marketing — Retail: test T5, gửi/audit T6. Wholesale: test T4, gửi/audit T5. Audit email Retail/Wholesale hàng tháng: từ ngày 25 trở đi. Báo cáo hiệu quả email: từ ngày 2 tháng sau.\n\n" +
      "Online Promotion (Retail + Last Mile) — Retail: chốt danh sách T3, thực thi T4, audit Shopify backend T5, audit frontend T6. Last Mile: tương tự Monthly Campaign — Deliveroo do Vinh setup, Hungry Panda/Uber Eats tự setup; audit từ ngày 1 hàng tháng.\n\n" +
      "Demo Event Page — không phải workstream riêng; nằm trong Social + Website + Email.\n\n" +
      "Video Content (Branded Video / 2D Design + Motion) — xác nhận brand mỗi 2 tuần vào T2; hạn brand T5; launch T6; audit T6/T7.\n\n" +
      "Double Date — audit trước DD 1 ngày.",
    input_needed: "Approved campaign brief and brand confirmation; product/SKU and stock confirmation from Purchasing; design assets from the Design team.",
    input_needed_vi: "Brief chiến dịch đã duyệt và xác nhận thương hiệu; xác nhận sản phẩm/SKU và tồn kho từ Purchasing; tài sản thiết kế từ team Design.",
    my_action: "Plan → Design → Schedule → Publish → Audit, per channel (Social, Website, Email, Online Promotion, Video).",
    my_action_vi: "Lên kế hoạch → Thiết kế → Lên lịch → Đăng → Audit, theo từng kênh (Social, Website, Email, Online Promotion, Video).",
    handover_to: "Design team (content/video assets), IT/Shopify (website publishing), Vinh (Deliveroo setup), Retail/Wholesale Sales (email content validation).",
    handover_to_vi: "Team Design (tài sản content/video), IT/Shopify (đăng website), Vinh (setup Deliveroo), Sales Retail/Wholesale (duyệt nội dung email).",
    deadline:
      "Content plan: start of month. Design: mid-month / every 2 weeks. Email test: the day before send. Monthly email audit: 25th+. Email performance report: 2nd+ of the following month. Last Mile audit: 1st+ of the month.",
    deadline_vi:
      "Kế hoạch content: đầu tháng. Thiết kế: giữa tháng / mỗi 2 tuần. Test email: trước ngày gửi 1 ngày. Audit email hàng tháng: từ ngày 25. Báo cáo hiệu quả email: từ ngày 2 tháng sau. Audit Last Mile: từ ngày 1 hàng tháng.",
    output: "~7 social posts/week; weekly Retail + Wholesale website banners; weekly Retail + Wholesale emails; weekly online/Last Mile promotion setup; bi-weekly branded/2D-motion video.",
    output_vi: "~7 bài Social/tuần; banner website Retail + Wholesale hàng tuần; email Retail + Wholesale hàng tuần; setup promotion online/Last Mile hàng tuần; video branded/2D-motion mỗi 2 tuần.",
    check_audit:
      "Website: Shopify backend (Tue) → website front-end (Fri). Email: test the day before send, then audit on send day; monthly audit 25th+. Online Promotion: Shopify backend (Thu) → front-end (Fri). Last Mile: 1st+ of month. Video: Fri/Sat. Double Date: 1 day before DD.",
    check_audit_vi:
      "Website: Shopify backend (T3) → frontend website (T6). Email: test trước ngày gửi, audit vào ngày gửi; audit hàng tháng từ ngày 25. Online Promotion: Shopify backend (T5) → frontend (T6). Last Mile: từ ngày 1 hàng tháng. Video: T6/T7. Double Date: trước DD 1 ngày.",
    important_rules:
      "Avoid extending campaign timing where possible — if an extension is unavoidable, handle it only within the requested date. Old website banners must be manually deleted after being hidden at campaign end — hiding alone is not enough. Email audit covers Timeline, Content, Link, Online Stock and Promotion cross-check (the last is optional).",
    important_rules_vi:
      "Hạn chế gia hạn thời gian campaign — nếu bắt buộc phải gia hạn thì chỉ xử lý trong phạm vi ngày được yêu cầu. Banner website cũ phải xóa thủ công sau khi ẩn khi campaign kết thúc — chỉ ẩn là chưa đủ. Audit email gồm Timeline, Content, Link, Online Stock và cross-check Promotion (mục cuối không bắt buộc).",
    status: "CURRENT",
    source: "Longdan 2026 Marketing Execution Plan — Digital workstream rules — supplied 2026-10-05",
  },
  {
    id: "ws-ap-execution",
    pic_name: "A&P (Advertising & Promotion) Execution",
    recurring_tasks: "Manages the supplier-funded marketing cycle: weekly execution planning, proposal follow-up, report follow-up, opportunity review and commercial package development.",
    recurring_tasks_vi: "Quản lý chu kỳ marketing do nhà cung cấp tài trợ: lên kế hoạch thực thi hàng tuần, theo dõi đề xuất, theo dõi báo cáo, review cơ hội và phát triển gói thương mại.",
    weekly_timing:
      "Mon → A&P Execution Planning — weekly priorities across Digital, Retail, In-store and Demo activities\nTue → A&P Proposal Follow-up — supplier responses, pending approvals, outstanding actions\nWed → A&P Report Follow-up — campaign results, supporting documents, completion status; chase missing information\nThu → A&P Master & Opportunity Review — execution gaps, supplier opportunities, potential new activities; Special A&P Package Development\nFri → A&P Audit & Finalisation — complete outstanding documentation, finalise approved proposal/report versions for release",
    weekly_timing_vi:
      "T2 → Lên kế hoạch thực thi A&P — ưu tiên tuần trên Digital, Retail, In-store và Demo\nT3 → Theo dõi đề xuất A&P — phản hồi nhà cung cấp, phê duyệt đang chờ, việc còn tồn đọng\nT4 → Theo dõi báo cáo A&P — kết quả chiến dịch, tài liệu hỗ trợ, tình trạng hoàn thành; đôn đốc thông tin thiếu\nT5 → Review A&P Master & Cơ hội — khoảng trống thực thi, cơ hội nhà cung cấp, hoạt động mới tiềm năng; phát triển gói A&P đặc biệt\nT6 → Audit & Hoàn tất A&P — hoàn thiện tài liệu còn thiếu, chốt phiên bản đề xuất/báo cáo đã duyệt để phát hành",
    input_needed: "Supplier proposal responses; campaign execution data from Retail/Digital/In-store/Demo; the A&P Master file.",
    input_needed_vi: "Phản hồi đề xuất từ nhà cung cấp; dữ liệu thực thi chiến dịch từ Retail/Digital/In-store/Demo; file A&P Master.",
    my_action: "Plan → Propose → Execute → Track → Review → Develop → Report → Finalise.",
    my_action_vi: "Lên kế hoạch → Đề xuất → Thực thi → Theo dõi → Review → Phát triển → Báo cáo → Hoàn tất.",
    handover_to: "Suppliers (finalised proposals/reports), Marketing leadership (A&P Master review).",
    handover_to_vi: "Nhà cung cấp (đề xuất/báo cáo đã chốt), lãnh đạo Marketing (review A&P Master).",
    deadline: "Weekly proposal/report follow-up cycle Tue–Thu; audit and finalisation by Friday.",
    deadline_vi: "Chu kỳ theo dõi đề xuất/báo cáo hàng tuần T3–T5; audit và hoàn tất trước Thứ 6.",
    output: "Updated A&P Master; finalised proposals/reports; new special A&P packages where supplier opportunities exist.",
    output_vi: "A&P Master được cập nhật; đề xuất/báo cáo đã chốt; gói A&P đặc biệt mới khi có cơ hội từ nhà cung cấp.",
    check_audit: "A&P Audit & Finalisation (Fri) — progress, documentation completeness, supplier follow-up.",
    check_audit_vi: "Audit & Hoàn tất A&P (T6) — tiến độ, độ đầy đủ tài liệu, theo dõi nhà cung cấp.",
    important_rules: "See Master → A&P Proposal Playbook for the proposal-building rules (target ≠ proposed ≠ confirmed budget, PO-based budgets, no invented market/brand claims).",
    important_rules_vi: "Xem Master → A&P Proposal Playbook để biết quy tắc xây dựng đề xuất (target ≠ proposed ≠ confirmed budget, ngân sách dựa trên PO, không bịa số liệu thị trường/thương hiệu).",
    execution_detail:
      "Key deliverables: A&P Proposals (Monthly — strategic brief for execution/resource planning), Execution Guidelines (Per campaign — SOPs, asset specs, channel timelines), Marketing Reports (Monthly/Quarterly — KPIs, ROI, sales impact), Internal Rollouts (Weekly — POSM instruction, TVC brief, retail team comms).\n\n" +
      "Broader weekly operational flow (2026 Execution Plan, cross-functional view): Mon — Planning & Content Drafting; Tue — POSM Review & eNews Creation; Wed — Promotion Set-up & Campaign Comms; Thu — Instruction Dispatch & Web Updates; Fri — Audits, eNews Send-outs, Demo Announcements. This is a broader cross-team summary, not a replacement for the A&P-specific cadence above.",
    execution_detail_vi:
      "Hạng mục chính: Đề xuất A&P (Hàng tháng — brief chiến lược cho kế hoạch thực thi/nguồn lực), Hướng dẫn thực thi (Theo chiến dịch — SOP, thông số tài sản, lịch kênh), Báo cáo Marketing (Hàng tháng/Quý — KPI, ROI, tác động doanh số), Triển khai nội bộ (Hàng tuần — hướng dẫn POSM, brief TVC, thông tin team retail).\n\n" +
      "Luồng vận hành tuần rộng hơn (2026 Execution Plan, góc nhìn liên nhóm): T2 — Lên kế hoạch & Soạn nội dung; T3 — Review POSM & Tạo eNews; T4 — Setup khuyến mãi & Thông báo chiến dịch; T5 — Gửi hướng dẫn & Cập nhật web; T6 — Audit, Gửi eNews, Thông báo Demo. Đây là tóm tắt liên nhóm rộng hơn, không thay thế nhịp làm việc riêng của A&P ở trên.",
    status: "CURRENT",
    source: "Marketing Execution Induction + Longdan 2026 Marketing Execution Plan — supplied 2026-10-03 / 2026-10-04",
  },
  {
    id: "ws-ops-marketing",
    pic_name: "Operation Marketing & Project Management",
    recurring_tasks:
      "Cross-functional operational control that connects the 4 execution workstreams above rather than operating independently — monitors, audits, coordinates and resolves issues across Retail, POSM/Demo/TVC, Digital and A&P, and identifies new marketing service opportunities.",
    recurring_tasks_vi:
      "Kiểm soát vận hành liên nhóm, kết nối 4 workstream thực thi ở trên thay vì hoạt động riêng lẻ — giám sát, audit, phối hợp và xử lý vấn đề trên Retail, POSM/Demo/TVC, Digital và A&P, đồng thời tìm cơ hội dịch vụ marketing mới.",
    weekly_timing:
      "Mon → Weekly Marketing Performance Review (prior week Demo/Retail/Digital post reports); Upcoming Activity Planning; Retail Email Audit\nTue → Demo & Marketing File Control; Design Brief Control; TVC Campaign Audit\nWed → Wholesale Email Audit; Online Campaign & Website Audit (Retail + Wholesale); Supplier Request Coordination; POSM Shipment Monitoring\nThu → POSM Package Support; A&P Operational Audit; Special A&P Package Development\nFri → Additional Marketing Project Support; Weekly Marketing Progress Review; New Marketing Service Development",
    weekly_timing_vi:
      "T2 → Review hiệu quả Marketing tuần trước (báo cáo Demo/Retail/Digital tuần trước); Lên kế hoạch hoạt động sắp tới; Audit Email Retail\nT3 → Kiểm soát file Demo & Marketing; Kiểm soát Design Brief; Audit chiến dịch TVC\nT4 → Audit Email Wholesale; Audit chiến dịch Online & Website (Retail + Wholesale); Phối hợp yêu cầu nhà cung cấp; Giám sát vận chuyển POSM\nT5 → Hỗ trợ gói POSM; Audit vận hành A&P; Phát triển gói A&P đặc biệt\nT6 → Hỗ trợ dự án Marketing khác; Review tiến độ Marketing tuần; Phát triển dịch vụ Marketing mới",
    input_needed: "Weekly reports from all 4 execution workstreams; supplier marketing requests received by the Marketing team.",
    input_needed_vi: "Báo cáo hàng tuần từ cả 4 workstream thực thi; yêu cầu marketing từ nhà cung cấp gửi tới team Marketing.",
    my_action: "Review → Monitor → Coordinate → Audit → Follow-up → Resolve → Improve → Develop.",
    my_action_vi: "Review → Giám sát → Phối hợp → Audit → Theo dõi → Xử lý → Cải thiện → Phát triển.",
    handover_to: "All 4 workstream owners (follow-up actions), Marketing leadership (consolidated weekly progress).",
    handover_to_vi: "Chủ sở hữu của cả 4 workstream (hành động theo dõi), lãnh đạo Marketing (tiến độ tuần tổng hợp).",
    deadline: "Weekly review cycle Mon–Fri; consolidated Marketing progress review on Friday.",
    deadline_vi: "Chu kỳ review hàng tuần T2–T6; review tiến độ Marketing tổng hợp vào Thứ 6.",
    output: "Weekly consolidated Marketing progress review; resolved cross-team issues; new marketing service / commercial opportunity recommendations.",
    output_vi: "Review tiến độ Marketing tổng hợp hàng tuần; vấn đề liên nhóm đã xử lý; đề xuất dịch vụ marketing / cơ hội thương mại mới.",
    check_audit: "Self-auditing role — audits A&P, TVC, Online Campaigns, Website and Email content every week.",
    check_audit_vi: "Vai trò tự audit — kiểm tra A&P, TVC, Chiến dịch Online, Website và nội dung Email mỗi tuần.",
    important_rules: "The 5 areas (Retail, POSM/Demo/TVC, Digital, A&P, Operation Marketing) must work together, not independently — this role is the connective layer across the other 4.",
    important_rules_vi: "5 mảng (Retail, POSM/Demo/TVC, Digital, A&P, Operation Marketing) phải phối hợp với nhau, không hoạt động riêng lẻ — vai trò này là lớp kết nối xuyên suốt 4 mảng còn lại.",
    status: "CURRENT",
    source: "Marketing Execution Induction — Operation Marketing & Project Management — supplied 2026-10-03",
  },
];

interface CampaignRuleSeed {
  id: string;
  rule_name: string;
  category: string;
  summary: string;
  body: string;
  body_vi?: string;
  status: "CURRENT" | "NEEDS VERIFICATION";
}

// Operational SOPs for running campaigns/promotions day to day — distinct from
// the campaign TAXONOMY in master_campaign_types. Displayed the same
// collapsed/click-to-expand way as Team Workstreams, for quick lookup.
const CAMPAIGN_RULES: CampaignRuleSeed[] = [
  {
    id: "cr-weekly-promo-update",
    rule_name: "Weekly Promotion Update",
    category: "Promotion Procedure",
    summary: "The weekly cycle for retiring expired promotions and bringing in the new IT set list.",
    body:
      "Step 1 — Open the Full sheet in the Master File. Identify all promotions with Valid Until date ending on Sunday of the current week. Highlight these rows in yellow.\n\n" +
      "Step 2 — Copy the highlighted list into the REMOVE sheet. Add any additional \"STOP\" requests received during the week. Summarise total SKUs scheduled for removal. Then, in the Full sheet, delete all rows for promotions that have expired or stopped.\n\n" +
      "Step 3 — For all remaining active promotions, update their Shop Execution Status to ONGOING.\n\n" +
      "Step 4 — Import the weekly IT set list into a new sheet, adjust format/layout as needed, and tag each SKU as NEW or ADJUST according to IT setup.\n\n" +
      "Step 5 — Update the Full sheet with this week's data and ensure label folder links are correctly inserted. Sort and organise the NEW and ADJUST sheets clearly.\n\n" +
      "Step 6 — Recheck and sort the entire file for accuracy. Once confirmed, inform Marketing (MKT), IT, and Purchasing (PUR). Finally, issue the weekly promotion announcement.",
    body_vi:
      "Bước 1 — Mở sheet Full trong Master File. Xác định tất cả khuyến mãi có Valid Until kết thúc vào Chủ Nhật của tuần hiện tại. Tô vàng các dòng này.\n\n" +
      "Bước 2 — Copy danh sách đã tô vàng vào sheet REMOVE. Thêm các yêu cầu \"STOP\" khác nhận được trong tuần. Tổng hợp số SKU sẽ bị gỡ. Sau đó, trong sheet Full, xóa tất cả các dòng khuyến mãi đã hết hạn hoặc bị dừng.\n\n" +
      "Bước 3 — Với các khuyến mãi còn đang chạy, cập nhật Shop Execution Status thành ONGOING.\n\n" +
      "Bước 4 — Import danh sách IT set tuần vào sheet mới, chỉnh format/layout nếu cần, gắn nhãn từng SKU là NEW hoặc ADJUST theo setup của IT.\n\n" +
      "Bước 5 — Cập nhật sheet Full với dữ liệu tuần này và đảm bảo link thư mục label được chèn đúng. Sắp xếp sheet NEW và ADJUST rõ ràng.\n\n" +
      "Bước 6 — Kiểm tra lại và sắp xếp toàn bộ file cho chính xác. Sau khi xác nhận, thông báo cho Marketing (MKT), IT và Purchasing (PUR). Cuối cùng, phát thông báo khuyến mãi hàng tuần.",
    status: "CURRENT",
  },
  {
    id: "cr-force-deactivate",
    rule_name: "Force De-active / Request to Stop",
    category: "Promotion Procedure",
    summary: "What to do when a shop requests a promotion be stopped (out-of-stock, expired, sold out).",
    body:
      "Situation: a shop team requests to stop a promotion due to out-of-stock, expired, or fully sold-out status.\n\n" +
      "Step 1 — Inform and consult with Owners/Purchasers to verify stock status across other shops and confirm next actions (replacement, extension, or full stop).\n\n" +
      "Step 2 — Access ePOS and either apply Force De-active, or adjust the Valid Until Date, based on instruction from Owners/Purchasers.\n\n" +
      "Step 3 — Update the Promotion Master File: set status to Request Stop or Force De-active (as per case); update Valid Until Date (if applicable); if the promotion is no longer valid across all shops, add it to the REMOVE sheet.\n\n" +
      "Step 4 — Inform the related shop staff/team about the update and ensure they reload the till. FYI: notify Owners, RSD, and the UK Audit Team of this update.",
    body_vi:
      "Tình huống: shop yêu cầu dừng khuyến mãi vì hết hàng, hết hạn, hoặc đã bán hết hoàn toàn.\n\n" +
      "Bước 1 — Thông báo và trao đổi với Owners/Purchasers để xác minh tình trạng tồn kho ở các shop khác và chốt hành động tiếp theo (thay thế, gia hạn, hoặc dừng hẳn).\n\n" +
      "Bước 2 — Vào ePOS và áp dụng Force De-active, hoặc chỉnh Valid Until Date, theo chỉ đạo của Owners/Purchasers.\n\n" +
      "Bước 3 — Cập nhật Promotion Master File: đặt status thành Request Stop hoặc Force De-active (tùy trường hợp); cập nhật Valid Until Date (nếu có); nếu khuyến mãi không còn hiệu lực ở tất cả shop, thêm vào sheet REMOVE.\n\n" +
      "Bước 4 — Thông báo cho nhân viên/team shop liên quan về cập nhật này và đảm bảo họ reload till. FYI: thông báo cho Owners, RSD, và UK Audit Team về cập nhật này.",
    status: "CURRENT",
  },
  {
    id: "cr-demo-checklist",
    rule_name: "Tasting Events / Demo Checklist",
    category: "Demo Procedure",
    summary: "Define operation type → product list → supporting products → POSM/TVC → internal coordination → pre-demo sign-off.",
    body:
      "Objective: deliver smooth, engaging, compliant in-store demos aligned with campaign calendars, stock availability and POSM/TVC rollouts.\n\n" +
      "1. Define Demo Operation Type — By Longdan Staff (confirm date/store per Marketing Calendar, coordinate rota with UK HR ≥7 days ahead, ensure product training/storytelling briefing); By Supplier (confirm with supplier + A&P, share demo SOPs/arrival time/product list, arrange site access and equipment); By Agent/Third Party (confirm schedule, merge multiple suppliers if applicable, provide product info/allergen sheets/store contacts).\n\n" +
      "2. Define Product Demo List — select from supplier launches, hero/seasonal bestsellers, or low-sales/high-stock SKUs; confirm stock levels per store via SAP + Stock Team before approving any SKU.\n\n" +
      "3. Select Supporting Products (cross-selling) — pair hero SKUs with basket-building items/OEM brands; confirm stock with Product Owners + store ops.\n\n" +
      "4. POSM & TVC Preparation — confirm formats (A3 Poster, TVC loop 15–20s, landscape banner, social assets 1080×1080, shelf talkers, wobblers, A4 allergy poster — mandatory, tentcard/mini poster); coordinate with Design Team for visuals/theme/tone; align with TVC Team for in-store screens; ensure food-safety signage is printed.\n\n" +
      "5. Internal Coordination — notify Product Owners/Buyers, Store Managers/Retail Ops, Stock & Warehouse, Delivery Team (stock arrives 1 day before demo), A&P Team (weekly rollout comms).\n\n" +
      "6. AI-assisted planning (optional) — product pairings/flavour themes, POSM copy drafts, social captions, staff briefing sheets; review and approve before use.\n\n" +
      "Final 2-Day Pre-Demo Checklist: staff/agent rota confirmed; stock levels checked; POSM printed & delivered; allergy posters/tentcards printed; store manager briefed; demo products delivered; cooking tools prepped; sampling cups/gloves/napkins ready; AI-generated copy reviewed; TVC content updated.",
    body_vi:
      "Mục tiêu: tổ chức demo tại cửa hàng suôn sẻ, hấp dẫn, tuân thủ quy định, phù hợp với lịch chiến dịch, tình trạng tồn kho và triển khai POSM/TVC.\n\n" +
      "1. Xác định loại hình Demo — Do nhân viên Longdan (xác nhận ngày/shop theo Marketing Calendar, phối hợp rota với UK HR trước ≥7 ngày, đảm bảo briefing đào tạo sản phẩm/storytelling); Do nhà cung cấp (xác nhận với supplier + A&P, chia sẻ SOP demo/giờ đến/danh sách sản phẩm, sắp xếp quyền vào cửa hàng và thiết bị); Do Agent/Bên thứ ba (xác nhận lịch, gộp nhiều nhà cung cấp nếu phù hợp, cung cấp thông tin sản phẩm/bảng dị ứng/liên hệ shop).\n\n" +
      "2. Xác định danh sách sản phẩm Demo — chọn từ sản phẩm mới ra mắt, hero/bán chạy theo mùa, hoặc SKU bán chậm/tồn cao; xác nhận tồn kho từng shop qua SAP + Stock Team trước khi duyệt bất kỳ SKU nào.\n\n" +
      "3. Chọn sản phẩm hỗ trợ (cross-selling) — ghép SKU hero với sản phẩm xây giỏ hàng/thương hiệu OEM; xác nhận tồn kho với Product Owners + vận hành shop.\n\n" +
      "4. Chuẩn bị POSM & TVC — xác nhận định dạng (Poster A3, TVC loop 15–20s, banner ngang, tài sản social 1080×1080, shelf talker, wobbler, poster dị ứng A4 — bắt buộc, tentcard/mini poster); phối hợp với team Design về hình ảnh/chủ đề/tông; liên hệ team TVC cho màn hình tại cửa hàng; đảm bảo biển an toàn thực phẩm được in.\n\n" +
      "5. Phối hợp nội bộ — thông báo Product Owners/Buyers, Store Managers/Retail Ops, Stock & Warehouse, Delivery Team (hàng đến trước demo 1 ngày), team A&P (thông tin triển khai hàng tuần).\n\n" +
      "6. Lên kế hoạch với AI (tùy chọn) — ghép sản phẩm/chủ đề hương vị, bản nháp nội dung POSM, caption social, tài liệu briefing nhân viên; review và duyệt trước khi dùng.\n\n" +
      "Checklist 2 ngày trước Demo: rota nhân viên/agent đã xác nhận; đã kiểm tra tồn kho; POSM đã in & giao; poster dị ứng/tentcard đã in; đã briefing quản lý shop; sản phẩm demo đã giao; dụng cụ nấu đã chuẩn bị; cốc/găng tay/khăn giấy đã sẵn sàng; nội dung AI đã review; nội dung TVC đã cập nhật.",
    status: "CURRENT",
  },
  {
    id: "cr-website-banners-retail",
    rule_name: "Website Banner Ideas — Retail (Longdan.co.uk)",
    category: "Digital Reference",
    summary: "Lifestyle/emotional banner concepts for B2C — Monthly Campaign Hero, Double Date Flash Sales, Clearance Countdown, eNewsletter, festive events.",
    body:
      "Goal: inspire shopping, highlight promotions, drive seasonal engagement. Tone: warm, lifestyle-driven, emotional, festive.\n\n" +
      "1. Monthly Campaign Hero — seasonal hero products (sakura sweets in March, BBQ kits in June, kimchi bundles in September). Message: \"Celebrate [Season] with authentic [Cuisine] flavours at Longdan.\" CTA: Shop Now.\n\n" +
      "2. Double Date Flash Sales — bold numeric design (2.2, 3.3, 4.4...) with product highlights. Message: \"One day only! [Date] Flash Sale.\" CTA: See Deals.\n\n" +
      "3. Clearance Countdown — clock/timer + stock pile imagery. Message: \"Stock Rotation Sale — Last Chance for [Category]!\" CTA: Clearance Shop.\n\n" +
      "4. eNewsletter Promo — friendly table-top food styling. Message: \"Discover seasonal recipes, tips & deals.\" CTA: Join the List.\n\n" +
      "5. Festive Event Blocks — Lunar New Year: \"Flavours of the Past, Tastes of the Future.\" Summer Fiesta: \"Grill, Chill & Celebrate.\" Black Friday: \"Asian Flavours, Unbeatable Prices.\" Christmas: \"Gifting from the Heart of Asia.\"",
    body_vi:
      "Mục tiêu: khơi gợi mua sắm, làm nổi bật khuyến mãi, tăng tương tác theo mùa. Tông giọng: ấm áp, gắn với lối sống, cảm xúc, không khí lễ hội. Các mẫu message/CTA dưới đây là bản nháp tiếng Anh dùng trực tiếp trên website — giữ nguyên không dịch vì là nội dung sáng tạo cho website tiếng Anh.\n\n" +
      "1. Monthly Campaign Hero — sản phẩm chủ lực theo mùa (bánh sakura tháng 3, bộ BBQ tháng 6, set kimchi tháng 9).\n\n" +
      "2. Double Date Flash Sales — thiết kế số đậm (2.2, 3.3, 4.4...) cùng sản phẩm nổi bật.\n\n" +
      "3. Clearance Countdown — hình ảnh đồng hồ đếm ngược + kho hàng.\n\n" +
      "4. eNewsletter Promo — hình ảnh bàn ăn gần gũi.\n\n" +
      "5. Festive Event Blocks — theo từng dịp lễ (Tết, Hè, Black Friday, Giáng sinh).",
    status: "CURRENT",
  },
  {
    id: "cr-website-banners-wholesale",
    rule_name: "Website Banner Ideas — Wholesale (LongdanWholesale.co.uk)",
    category: "Digital Reference",
    summary: "ROI/efficiency-driven banner concepts for B2B — Longdan Plus, bulk Monthly Campaign angle, Clearance/Overstock, Double Date trade, Anniversary.",
    body:
      "Goal: encourage bulk purchasing, loyalty program sign-ups, stock-up events. Tone: professional, efficient, ROI-driven, practical.\n\n" +
      "1. Longdan Plus Program (LP) — pallet-style stock, wholesale packs. Message: \"Exclusive Hampers & Wholesale Pricing for Members.\" CTA: Join Longdan Plus.\n\n" +
      "2. Monthly Campaign with Bulk Angle — Feb/Tet: \"Wholesale Tet Hampers.\" Jun/Summer: \"Summer BBQ Essentials in Bulk.\" Sep/Chuseok: \"Member-Only Bundles: Kimchi & Rice Cakes.\"\n\n" +
      "3. Clearance / Overstock Deals — warehouse shelves, stacked cartons. Message: \"Mid-Year Overstock Clearance — Trade-Only Savings.\" CTA: View Clearance.\n\n" +
      "4. Double Date Trade Specials — calendar overlay + product bundles. Message: \"[Date] Bulk Flash Sale — Stock Smart, Save Big.\" CTA: Buy in Bulk.\n\n" +
      "5. Anniversary / Loyalty Rewards — 20-year legacy seal, handshake imagery. Message: \"20 Years with Longdan — Thank You for Partnering with Us.\" CTA: Shop Anniversary Deals.\n\n" +
      "Key difference from Retail: wholesale banners lead with efficiency and value (bulk pricing, loyalty, margin growth), not lifestyle/emotion.",
    body_vi:
      "Mục tiêu: khuyến khích mua số lượng lớn, đăng ký chương trình loyalty, sự kiện gom hàng. Tông giọng: chuyên nghiệp, hiệu quả, hướng ROI, thực tế. Các mẫu message/CTA dưới đây là bản nháp tiếng Anh dùng trực tiếp trên website — giữ nguyên không dịch.\n\n" +
      "1. Longdan Plus Program (LP) — hình ảnh hàng pallet, gói wholesale.\n\n" +
      "2. Monthly Campaign góc nhìn mua sỉ — theo từng tháng/dịp (Tết, Hè, Chuseok).\n\n" +
      "3. Clearance / Overstock Deals — hình ảnh kệ kho, thùng carton xếp chồng.\n\n" +
      "4. Double Date Trade Specials — lịch + combo sản phẩm.\n\n" +
      "5. Anniversary / Loyalty Rewards — hình ảnh 20 năm, bắt tay đối tác.\n\n" +
      "Khác biệt chính so với Retail: banner wholesale tập trung vào hiệu quả và giá trị (giá sỉ, loyalty, tăng trưởng biên lợi nhuận), không phải cảm xúc/lối sống.",
    status: "CURRENT",
  },
];

function upsertService(db: Database.Database, s: ServiceSeed, year: number, source: string, sortOrder: number) {
  const { duration, storeCoverage, channel } = s.coverage ? splitCoverage(s.coverage) : { duration: null, storeCoverage: null, channel: null };
  const descriptionVi = SERVICE_VI_BY_ID[s.id] ?? SERVICE_VI[s.service_name] ?? null;
  db.prepare(
    `INSERT INTO master_services (id, category, service_name, package, description, price_gbp, price_usd, price_eur,
        duration, store_coverage, channel, coverage_raw, notes, description_vi, year, effective_period, source, status, sort_order)
     VALUES (@id, @category, @service_name, @package, @description, @price_gbp, @price_usd, @price_eur,
        @duration, @store_coverage, @channel, @coverage_raw, @notes, @description_vi, @year, @effective_period, @source, @status, @sort_order)
     ON CONFLICT(id) DO UPDATE SET
       category = excluded.category, service_name = excluded.service_name, package = excluded.package,
       description = excluded.description, price_gbp = excluded.price_gbp, price_usd = excluded.price_usd,
       price_eur = excluded.price_eur, duration = excluded.duration, store_coverage = excluded.store_coverage,
       channel = excluded.channel, coverage_raw = excluded.coverage_raw, notes = excluded.notes,
       description_vi = excluded.description_vi,
       effective_period = excluded.effective_period, source = excluded.source, status = excluded.status,
       sort_order = excluded.sort_order, last_updated = datetime('now')`
  ).run({
    id: s.id,
    category: s.category,
    service_name: s.service_name,
    package: s.package ?? null,
    description: s.description,
    price_gbp: s.price_gbp,
    price_usd: s.price_usd,
    price_eur: s.price_eur,
    duration,
    store_coverage: storeCoverage,
    channel,
    coverage_raw: s.coverage,
    notes: s.notes ?? null,
    description_vi: descriptionVi,
    year,
    effective_period: `${year} rate card`,
    source,
    status: s.status ?? "CURRENT",
    sort_order: sortOrder,
  });
}

export function seedMasterKnowledge(db: Database.Database): void {
  const tx = db.transaction(() => {
    SERVICES_2027.forEach((s, i) => upsertService(db, s, 2027, SOURCE_2027, i));
    SERVICES_2026.forEach((s, i) => upsertService(db, s, 2026, SOURCE_2026, i));

    const insertTerm = db.prepare(
      `INSERT INTO master_coverage_terms (id, term_type, term_value, year, sort_order) VALUES (@id, @term_type, @term_value, @year, @sort_order)
       ON CONFLICT(id) DO UPDATE SET term_value = excluded.term_value, sort_order = excluded.sort_order`
    );
    COVERAGE_TERMS_2027.forEach((group) => {
      group.values.forEach((v, i) => {
        insertTerm.run({ id: `ct27-${group.term_type.replace(/[^a-z]/gi, "").toLowerCase()}-${i}`, term_type: group.term_type, term_value: v, year: 2027, sort_order: i });
      });
    });

    const insertCampaignType = db.prepare(
      `INSERT INTO master_campaign_types (id, name, what_it_is, frequency, timing_rule, duration, purpose, typical_deliverables, notes, explanation_vi, year, effective_period, source, status, sort_order)
       VALUES (@id, @name, @what_it_is, @frequency, @timing_rule, @duration, @purpose, @typical_deliverables, @notes, @explanation_vi, @year, @effective_period, @source, @status, @sort_order)
       ON CONFLICT(id) DO UPDATE SET
         what_it_is = excluded.what_it_is, frequency = excluded.frequency, timing_rule = excluded.timing_rule,
         duration = excluded.duration, purpose = excluded.purpose, typical_deliverables = excluded.typical_deliverables,
         notes = excluded.notes, explanation_vi = excluded.explanation_vi, status = excluded.status, last_updated = datetime('now')`
    );
    CAMPAIGN_TYPES.forEach((c, i) => {
      insertCampaignType.run({ ...c, notes: c.notes ?? null, year: 2026, effective_period: "2026 — current", source: "Longdan campaign taxonomy rules — supplied 2026-10-01", status: c.status ?? "CURRENT", sort_order: i });
    });

    const insertStep = db.prepare(
      `INSERT INTO master_ap_playbook_steps (id, step_order, step_name, description, description_vi, rules, source, status)
       VALUES (@id, @step_order, @step_name, @description, @description_vi, @rules, @source, 'CURRENT')
       ON CONFLICT(id) DO UPDATE SET description = excluded.description, description_vi = excluded.description_vi, rules = excluded.rules, last_updated = datetime('now')`
    );
    AP_PLAYBOOK_STEPS.forEach((s) => insertStep.run({ ...s, source: "A&P Proposal Playbook — supplied 2026-10-01" }));

    db.prepare("DELETE FROM master_ap_checklist_items").run();
    const insertChecklist = db.prepare("INSERT INTO master_ap_checklist_items (id, sort_order, item) VALUES (?, ?, ?)");
    AP_CHECKLIST.forEach((item, i) => insertChecklist.run(`ap-check-${i}`, i, item));

    const insertHandbook = db.prepare(
      `INSERT INTO master_handbook_entries (id, category, title, body, body_vi, summary_vi, source, status, sort_order)
       VALUES (@id, @category, @title, @body, @body_vi, @summary_vi, @source, @status, @sort_order)
       ON CONFLICT(id) DO UPDATE SET category = excluded.category, body = excluded.body, body_vi = excluded.body_vi, summary_vi = excluded.summary_vi, status = excluded.status, last_updated = datetime('now')`
    );
    HANDBOOK_ENTRIES.forEach((h, i) => insertHandbook.run({ ...h, body_vi: h.body_vi ?? null, sort_order: i }));

    const insertWorkstream = db.prepare(
      `INSERT INTO master_workstreams (id, pic_name, recurring_tasks, recurring_tasks_vi, weekly_timing, weekly_timing_vi, input_needed, input_needed_vi, my_action, my_action_vi, handover_to, handover_to_vi, deadline, deadline_vi, output, output_vi, check_audit, check_audit_vi, important_rules, important_rules_vi, execution_detail, execution_detail_vi, status, source, sort_order)
       VALUES (@id, @pic_name, @recurring_tasks, @recurring_tasks_vi, @weekly_timing, @weekly_timing_vi, @input_needed, @input_needed_vi, @my_action, @my_action_vi, @handover_to, @handover_to_vi, @deadline, @deadline_vi, @output, @output_vi, @check_audit, @check_audit_vi, @important_rules, @important_rules_vi, @execution_detail, @execution_detail_vi, @status, @source, @sort_order)
       ON CONFLICT(id) DO UPDATE SET
         pic_name = excluded.pic_name, recurring_tasks = excluded.recurring_tasks, recurring_tasks_vi = excluded.recurring_tasks_vi,
         weekly_timing = excluded.weekly_timing, weekly_timing_vi = excluded.weekly_timing_vi,
         input_needed = excluded.input_needed, input_needed_vi = excluded.input_needed_vi,
         my_action = excluded.my_action, my_action_vi = excluded.my_action_vi,
         handover_to = excluded.handover_to, handover_to_vi = excluded.handover_to_vi,
         deadline = excluded.deadline, deadline_vi = excluded.deadline_vi,
         output = excluded.output, output_vi = excluded.output_vi,
         check_audit = excluded.check_audit, check_audit_vi = excluded.check_audit_vi,
         important_rules = excluded.important_rules, important_rules_vi = excluded.important_rules_vi,
         execution_detail = excluded.execution_detail, execution_detail_vi = excluded.execution_detail_vi,
         status = excluded.status, source = excluded.source, sort_order = excluded.sort_order, last_updated = datetime('now')`
    );
    WORKSTREAMS.forEach((w, i) =>
      insertWorkstream.run({
        ...w,
        recurring_tasks_vi: w.recurring_tasks_vi ?? null,
        weekly_timing_vi: w.weekly_timing_vi ?? null,
        input_needed_vi: w.input_needed_vi ?? null,
        my_action_vi: w.my_action_vi ?? null,
        handover_to_vi: w.handover_to_vi ?? null,
        deadline_vi: w.deadline_vi ?? null,
        output_vi: w.output_vi ?? null,
        check_audit_vi: w.check_audit_vi ?? null,
        important_rules_vi: w.important_rules_vi ?? null,
        execution_detail: w.execution_detail ?? null,
        execution_detail_vi: w.execution_detail_vi ?? null,
        sort_order: i,
      })
    );

    const insertCampaignRule = db.prepare(
      `INSERT INTO master_campaign_rules (id, rule_name, category, summary, body, body_vi, status, source, sort_order)
       VALUES (@id, @rule_name, @category, @summary, @body, @body_vi, @status, @source, @sort_order)
       ON CONFLICT(id) DO UPDATE SET
         rule_name = excluded.rule_name, category = excluded.category, summary = excluded.summary, body = excluded.body,
         body_vi = excluded.body_vi, status = excluded.status, last_updated = datetime('now')`
    );
    CAMPAIGN_RULES.forEach((r, i) => insertCampaignRule.run({ ...r, body_vi: r.body_vi ?? null, source: "Longdan 2026 Marketing Execution Plan — supplied 2026-10-04", sort_order: i }));
  });
  tx();
}
