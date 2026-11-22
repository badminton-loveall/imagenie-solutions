export const company = {
  name: 'Imagenie Solutions',
  domain: 'imageniestudio.in',
  email: 'info@imageniestudio.in',
  phone: '+91 99721 51617',
  phoneHref: 'tel:+919972151617',
  whatsappNumber: '919972151617',
  address: 'Flat/Door/Block No. 201, Dreams Heritage, Block 1, Vakayil Lane, Sawmill Road, Thrissur, Kerala 680007',
  addressLines: [
    'Flat/Door/Block No. 201, Dreams Heritage',
    'Block 1, Vakayil Lane, Sawmill Road',
    'Thrissur, Kerala 680007',
  ],
}

export type Product = {
  name: 'Qwait' | 'Smrithi' | 'LoveAll' | 'LekhPath'
  domain: string
  url: string
  line: string
  pitch: string
  forWho: string
  features: string[]
}

export const products: Product[] = [
  {
    name: 'Qwait',
    domain: 'qwait.in',
    url: 'https://www.qwait.in',
    line: 'QR queues and tokens, no app needed',
    pitch:
      'A paperless queue and token system. People scan a QR code, take a token for today or a later date, and watch their turn arrive live on their phone.',
    forWho: 'Clinics, hospitals, banks, government offices, Akshaya centres, salons and events',
    features: ['Join with a scan, no sign-up', 'Book tokens ahead', 'Event tickets by UPI and QR gate entry'],
  },
  {
    name: 'Smrithi',
    domain: 'smrithi.in',
    url: 'https://www.smrithi.in',
    line: 'Galleries and face search for photographers',
    pitch:
      'Studio websites and client galleries for wedding and event photographers. Guests take a selfie and see only the photos they are in.',
    forWho: 'Wedding, event and portrait photography studios',
    features: ['Face search with a selfie', 'Client picks with original filenames', 'A studio website that fills itself'],
  },
  {
    name: 'LoveAll',
    domain: 'loveall.co.in',
    url: 'https://www.loveall.co.in',
    line: 'Training management for badminton academies',
    pitch:
      'Players, batches, 8-week training plans, assessments, attendance and fees, run from one place instead of registers and WhatsApp groups.',
    forWho: 'Badminton academies, head coaches, assistant coaches and families',
    features: ['8-week training cycles', 'Attendance and leave in a few taps', 'Fee ledger with overdue alerts'],
  },
  {
    name: 'LekhPath',
    domain: 'lekhpath.com',
    url: 'https://www.lekhpath.com',
    line: 'Personal accounting for Indian households',
    pitch:
      'A simple accounting app. Record income, expenses, assets and liabilities against your own account heads, by typing or by voice, and get statements and reports.',
    forWho: 'Households, families and small businesses',
    features: ['Voice entry for daily expenses and UPI payments', 'Share your accounts with family', 'Free 30-day trial, then Plus or Pro in rupees'],
  },
]

export const interests = ['A Labs product', 'A custom app', 'Video production'] as const
export type Interest = (typeof interests)[number]
