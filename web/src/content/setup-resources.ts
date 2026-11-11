/** Official service links. Version requirements come from the repository. */
export const setupLinks = {
  python: 'https://www.python.org/downloads/',
  pythonWindows: 'https://docs.python.org/3.12/using/windows.html',
  pip: 'https://pip.pypa.io/en/stable/installation/',
  venv: 'https://docs.python.org/3.12/library/venv.html',
  powershell: 'https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows',
  groqKeys: 'https://console.groq.com/keys',
  groqModels: 'https://console.groq.com/docs/models',
  git: 'https://git-scm.com/install/windows',
  node: 'https://nodejs.org/en/download',
  supabase: 'https://supabase.com/dashboard',
  resend: 'https://resend.com/api-keys',
  resendTesting: 'https://resend.com/docs/knowledge-base/403-error-resend-dev-domain',
  prisma: 'https://www.prisma.io/docs',
} as const;
export const requiredSetupResources = [
  { title: 'Python 3.12', badge: 'Required · assistant', text: 'Runs the stateless Flask / Waitress worker and Groq tool-calling loop. No desktop setup window is needed.', links: [{label:'Python downloads',href:setupLinks.python},{label:'Windows guide',href:setupLinks.pythonWindows}], note:'Use a virtual environment and the repository requirements file.' },
  { title: 'Node.js + npm', badge: 'Required · commerce & chat', text: 'Use Node 22.12 or newer for the TypeScript commerce service, Prisma client and React chat.', links:[{label:'Node.js downloads',href:setupLinks.node}], note:'Install dependencies separately in setup/node, chat and web.' },
  { title:'Supabase PostgreSQL',badge:'Required · persistence',text:'Products, reviews, customers, addresses, chats, OTP challenges and orders live in the remote database.',links:[{label:'Supabase dashboard',href:setupLinks.supabase},{label:'Prisma documentation',href:setupLinks.prisma}],note:'Preserve existing data. Inspect and apply the additive SQL scripts; never reset the live database.' },
  { title:'Groq account',badge:'Required · live answers',text:'Create a key and choose a tool-capable model available to your account. Configure the Python environment file.',links:[{label:'API keys',href:setupLinks.groqKeys},{label:'Available models',href:setupLinks.groqModels}],note:'Provider availability and account limits affect live answers.' },
  { title:'Resend account',badge:'Required · email verification',text:'Configure a sending key and a valid sender email. A display name alone is not a sender address.',links:[{label:'Resend API keys',href:setupLinks.resend},{label:'Test-sender restriction',href:setupLinks.resendTesting}],note:'onboarding@resend.dev can email only the Resend account owner. Other recipients require a verified domain.' },
];
export const optionalSetupResources = [
  {title:'Git for Windows',label:'Download Git',href:setupLinks.git,text:'Clone the repository and review changes. A downloaded ZIP also works.'},
  {title:'PowerShell',label:'PowerShell installation',href:setupLinks.powershell,text:'The commands and live-log launcher in this guide use Windows PowerShell.'},
];
