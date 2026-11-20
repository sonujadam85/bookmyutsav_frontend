import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, mainAdminGuard, superGuard } from './core/auth.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent), title: 'Login · BookMyUtsav' },
  { path: 'signup', canActivate: [guestGuard], loadComponent: () => import('./features/auth/signup.component').then((m) => m.SignupComponent), title: 'Sign up · BookMyUtsav' },
  // Public booking pages for clients - no login needed. /book = main company, /book/<profile> = that company.
  { path: 'book', loadComponent: () => import('./features/booking/book.component').then((m) => m.BookComponent), title: 'Book your event' },
  { path: 'book/:slug', loadComponent: () => import('./features/booking/book.component').then((m) => m.BookComponent), title: 'Book your event' },
  {
    path: 'receipt/:paymentId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/finance/receipt.component').then((m) => m.ReceiptComponent),
    title: 'Payment Receipt',
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent), title: 'Dashboard · BookMyUtsav' },
      { path: 'calendar', loadComponent: () => import('./features/calendar/calendar.component').then((m) => m.CalendarComponent), title: 'Calendar · BookMyUtsav' },
      { path: 'events', loadComponent: () => import('./features/events/event-list.component').then((m) => m.EventListComponent), title: 'Events · BookMyUtsav' },
      { path: 'events/new', loadComponent: () => import('./features/events/event-form.component').then((m) => m.EventFormComponent), title: 'New Event · BookMyUtsav' },
      { path: 'events/:id/edit', loadComponent: () => import('./features/events/event-form.component').then((m) => m.EventFormComponent), title: 'Edit Event · BookMyUtsav' },
      { path: 'events/:id', loadComponent: () => import('./features/events/event-detail.component').then((m) => m.EventDetailComponent), title: 'Event · BookMyUtsav' },
      { path: 'clients', loadComponent: () => import('./features/clients/client-list.component').then((m) => m.ClientListComponent), title: 'Clients · BookMyUtsav' },
      { path: 'clients/:id', loadComponent: () => import('./features/clients/client-detail.component').then((m) => m.ClientDetailComponent), title: 'Client · BookMyUtsav' },
      { path: 'bookings', loadComponent: () => import('./features/booking/bookings.component').then((m) => m.BookingsComponent), title: 'Booked Events · BookMyUtsav' },
      { path: 'services', loadComponent: () => import('./features/services/services.component').then((m) => m.ServicesComponent), title: 'Services & Prices · BookMyUtsav' },
      { path: 'vendors', loadComponent: () => import('./features/vendors/vendor-list.component').then((m) => m.VendorListComponent), title: 'Vendors · BookMyUtsav' },
      { path: 'vendors/:id', loadComponent: () => import('./features/vendors/vendor-detail.component').then((m) => m.VendorDetailComponent), title: 'Vendor · BookMyUtsav' },
      { path: 'inventory', loadComponent: () => import('./features/inventory/inventory.component').then((m) => m.InventoryComponent), title: 'Inventory · BookMyUtsav' },
      { path: 'payments', loadComponent: () => import('./features/finance/payments.component').then((m) => m.PaymentsComponent), title: 'Payments · BookMyUtsav' },
      { path: 'expenses', loadComponent: () => import('./features/finance/expenses.component').then((m) => m.ExpensesComponent), title: 'Expenses · BookMyUtsav' },
      { path: 'reports', canActivate: [adminGuard], loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent), title: 'Reports · BookMyUtsav' },
      { path: 'admin/companies', canActivate: [superGuard], loadComponent: () => import('./features/admin/companies.component').then((m) => m.CompaniesComponent), title: 'Companies · BookMyUtsav' },
      { path: 'users', canActivate: [mainAdminGuard], loadComponent: () => import('./features/admin/users.component').then((m) => m.UsersComponent), title: 'Users · BookMyUtsav' },
      { path: 'settings', loadComponent: () => import('./features/admin/settings.component').then((m) => m.SettingsComponent), title: 'Settings · BookMyUtsav' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
