import { lazy } from 'react';

const HomeDashboard = lazy(() => import('./views/home/Dashboard.js'));
const HomeContactSearch = lazy(() => import('./views/home/HomeContactSearch'));
const AdminUsers = lazy(() => import('./views/home/AdminUsers'));
const HomeContentStats = lazy(() => import('./views/home/HomeContentStats'));
const HomeCampaigns = lazy(() => import('./views/home/HomeCampaigns'));
const CampaignEdit = lazy(() => import('./views/campaigns/CampaignEdit'));
const Incomes = lazy(() => import('./views/incomes/Incomes'));

const routes = [
  { path: '/', exact: true, name: 'Home', component: HomeDashboard },
  { path: '/searchContact', exact: true, name: 'HomeContactSearch', component: HomeContactSearch },
  { path: '/users', exact: true, name: 'AdminUsers', component: AdminUsers },
  { path: '/contentStats', exact: true, name: 'HomeContentStats', component: HomeContentStats },
  { path: '/contentStats/:section', exact: true, name: 'HomeContentStats', component: HomeContentStats },
  { path: '/campaigns', exact: true, name: 'HomeCampaigns', component: HomeCampaigns },
  { path: '/campaigns/list/:campaign_id', exact: true, name: 'CampaignEdit', component: CampaignEdit },
  { path: '/campaigns/list/:campaign_id/:section', exact: true, name: 'CampaignEdit', component: CampaignEdit },
  { path: '/incomes', exact: true, name: 'Incomes', component: Incomes }
];

export default routes;
