// Maps CDP ARIA roles to normalized roles used by the agent-computer Element format.

const CDP_ROLE_MAP: Record<string, string> = {
  // Interactive controls
  button: 'button',
  textbox: 'textfield',
  searchbox: 'textfield',
  textfield: 'textfield',
  link: 'link',
  checkbox: 'checkbox',
  radio: 'radio',
  slider: 'slider',
  spinbutton: 'slider',
  combobox: 'dropdown',
  listbox: 'dropdown',
  popupbutton: 'dropdown',

  // Media
  img: 'image',
  image: 'image',

  // Text content
  heading: 'text',
  StaticText: 'text',
  LabelText: 'text',
  paragraph: 'text',
  status: 'text',

  // Tabs
  tab: 'tab',
  tablist: 'tabgroup',
  tabpanel: 'group',

  // Menus
  menuitem: 'menuitem',
  menu: 'group',
  menubar: 'group',

  // Tables
  table: 'table',
  grid: 'table',
  row: 'row',
  cell: 'row',
  gridcell: 'row',
  columnheader: 'row',
  rowheader: 'row',

  // Trees
  tree: 'treeview',
  treeitem: 'menuitem',

  // Misc widgets
  scrollbar: 'scrollarea',
  progressbar: 'progress',

  // Generic / presentational
  generic: 'generic',
  none: 'generic',
  presentation: 'generic',
  separator: 'generic',

  // Document / web areas
  WebArea: 'webarea',
  RootWebArea: 'webarea',
  document: 'webarea',

  // Landmark & structural → group
  navigation: 'group',
  region: 'group',
  main: 'group',
  form: 'group',
  section: 'group',
  article: 'group',
  banner: 'group',
  complementary: 'group',
  contentinfo: 'group',
  list: 'group',
  listitem: 'group',
  group: 'group',
  toolbar: 'group',
  dialog: 'group',
  alertdialog: 'group',
  alert: 'group',
};

/** Map a CDP ARIA role string to a normalized role. Unknown roles become 'generic'. */
export function mapCDPRole(cdpRole: string): string {
  return CDP_ROLE_MAP[cdpRole] ?? 'generic';
}

/**
 * CDP roles considered interactive — used to filter the AX tree in interactive mode.
 * These are CDP/ARIA role strings (keys in CDP_ROLE_MAP), not normalized roles.
 */
export const INTERACTIVE_ROLES = new Set([
  'button',
  'textbox',
  'searchbox',
  'textfield',
  'link',
  'checkbox',
  'radio',
  'slider',
  'spinbutton',
  'combobox',
  'listbox',
  'popupbutton',
  'tab',
  'menuitem',
  'treeitem',
]);
