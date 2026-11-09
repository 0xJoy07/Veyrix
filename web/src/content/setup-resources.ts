/** Official setup destinations; package versions remain in the repository manifests. */
export const setupLinks = {
  python: 'https://www.python.org/downloads/release/python-31210/',
  pythonWindows: 'https://docs.python.org/3.12/using/windows.html',
  tkinter: 'https://docs.python.org/3.12/library/tkinter.html',
  pip: 'https://pip.pypa.io/en/stable/installation/',
  venv: 'https://docs.python.org/3.12/library/venv.html',
  sqlite: 'https://docs.python.org/3.12/library/sqlite3.html',
  powershell: 'https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows',
  groqKeys: 'https://console.groq.com/keys',
  groqModels: 'https://console.groq.com/docs/models',
  groqTools: 'https://console.groq.com/docs/tool-use/local-tool-calling',
  git: 'https://git-scm.com/install/windows',
  node: 'https://nodejs.org/en/download',
  postgres: 'https://www.postgresql.org/download/windows/',
  mysql: 'https://dev.mysql.com/downloads/mysql/',
} as const;

export const requiredSetupResources = [
  {
    title: 'Python 3.12 + Tkinter',
    badge: 'Required · runtime',
    text: 'Use Python 3.12 for the validated setup. Keep pip and Tcl/Tk selected in the full Windows installer, enable Add python.exe to PATH, and reopen PowerShell after installation.',
    links: [
      { label: 'Python 3.12.10 installers', href: setupLinks.python },
      { label: 'Windows setup guide', href: setupLinks.pythonWindows },
    ],
    note: 'The installer link is the archived 3.12.10 release, not the latest Python release.',
  },
  {
    title: 'PowerShell',
    badge: 'Required · command line',
    text: 'Open Windows PowerShell or PowerShell in the repository root. The commands below use Windows paths. Use Microsoft’s installation guide if you need to install PowerShell.',
    links: [{ label: 'PowerShell for Windows', href: setupLinks.powershell }],
    note: 'An existing working PowerShell installation is sufficient for this walkthrough.',
  },
  {
    title: 'Groq account & API key',
    badge: 'Required · live chat',
    text: 'Sign in to Groq, create an API key, and choose an available model that supports tool calling. Enter the key in the local setup window and check it with Test Groq.',
    links: [
      { label: 'Create a Groq API key', href: setupLinks.groqKeys },
      { label: 'Available models', href: setupLinks.groqModels },
      { label: 'Tool-calling support', href: setupLinks.groqTools },
    ],
    note: 'Live chat needs internet access. The automated tests use a mock model and need no key.',
  },
];

export const optionalSetupResources = [
  { title: 'Git for Windows', label: 'Download Git', href: setupLinks.git, text: 'Use Git to clone the repository and pull updates. Downloading and extracting the repository ZIP also works.' },
  { title: 'Node.js + npm', label: 'Download Node.js', href: setupLinks.node, text: 'Only needed to develop or build the documentation in web. Choose a supported LTS release, version 22.12 or newer. npm comes with the standard installer.' },
  { title: 'PostgreSQL', label: 'PostgreSQL installers', href: setupLinks.postgres, text: 'Only needed if you choose PostgreSQL instead of the SQLite sample. Install or provision a server separately; the Python database driver is included in the requirements.' },
  { title: 'MySQL Community Server', label: 'Download MySQL', href: setupLinks.mysql, text: 'Only needed for a MySQL connection. Provision a server and database separately; PyMySQL is installed with the requirements. Live MySQL validation is still pending.' },
];
