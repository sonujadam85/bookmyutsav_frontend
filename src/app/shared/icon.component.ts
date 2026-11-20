import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Outline icons (24x24, stroke based).
const ICONS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  event: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  users: 'M17 20h5v-2a4 4 0 00-5-3.9M9 20H2v-2a4 4 0 014-4h3a4 4 0 014 4v2H9zm3-11a3 3 0 11-6 0 3 3 0 016 0zm8 1a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  client: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1',
  vendor: 'M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6',
  box: 'M21 8l-9-5-9 5m18 0v8l-9 5m9-13l-9 5m0 8l-9-5V8m9 13v-8M3 8l9 5',
  wallet: 'M3 7a2 2 0 012-2h13v4M3 7v10a2 2 0 002 2h15V9H5a2 2 0 01-2-2zm14 6h.01',
  receipt: 'M6 2h12v20l-3-2-3 2-3-2-3 2V2zm3 6h6M9 12h6M9 16h4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  report: 'M9 17v-6M13 17v-3M17 17v-9M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 00-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 002 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z',
  search: 'M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 13l4 4L19 7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  logout: 'M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 01-2-2V5a2 2 0 012-2h7',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  clock: 'M12 7v5l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zm0-8a3 3 0 100-6 3 3 0 000 6z',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 006 6L16 13l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z',
  money: 'M12 3v18M17 7H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  upload: 'M12 21V9m0 0l-4 4m4-4l4 4M4 7V5a2 2 0 012-2h12a2 2 0 012 2v2',
  print: 'M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-2M6 14h12v7H6v-7z',
  file: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zm0 0v6h6',
  image: 'M4 5h16v14H4V5zm4 5a2 2 0 100-4 2 2 0 000 4zm12 5l-5-5-9 9',
  alert: 'M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8',
  lock: 'M6 11V7a6 6 0 1112 0v4M5 11h14v10H5V11z',
  copy: 'M8 8h12v12H8V8zM4 16V4h12',
  refresh: 'M4 4v6h6M20 20v-6h-6M5.5 15a7.5 7.5 0 0012.9 2.6M18.5 9A7.5 7.5 0 005.6 6.4',
  trending: 'M3 17l6-6 4 4 8-8M15 7h6v6',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="d()" /></svg>`,
  host: { class: 'inline-flex shrink-0' },
})
export class IconComponent {
  name = input.required<string>();
  size = input<number>(18);
  stroke = input<number>(1.8);
  d = computed(() => ICONS[this.name()] ?? ICONS['event']);
}
