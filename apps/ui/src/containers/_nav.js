export default (location, currentEmailingDatabase, userEntreprise, enterprise) => {
  if (currentEmailingDatabase) {
    if (window.innerWidth < 992) {
      let result = [
        {
          _tag: 'CSidebarNavDropdown',
          name: 'Home',
          _children: _home(currentEmailingDatabase, userEntreprise)
        },
        {
          _tag: 'CSidebarNavDropdown',
          name: 'Contacts',
          _children: _contacts(currentEmailingDatabase)
        },
        {
          _tag: 'CSidebarNavDropdown',
          name: 'Contents',
          _children: _contents(currentEmailingDatabase)
        },
        {
          _tag: 'CSidebarNavDropdown',
          name: 'Sendings',
          _children: _sendings(currentEmailingDatabase, userEntreprise)
        }
      ];
      if (userEntreprise?.role === 'superAdmin') {
        result.push({
          _tag: 'CSidebarNavDropdown',
          name: 'Admin',
          _children: _admin(currentEmailingDatabase)
        });
      }
      return result;
    } else {
      var paths = location.pathname.split('/');
      if (paths.length <= 2) {
        return [];
      }
      let section = paths[2];
      switch (section) {
        case 'contacts':
          return _contacts(currentEmailingDatabase);

        case 'contents':
          return _contents(currentEmailingDatabase);

        case 'sendings':
          return _sendings(currentEmailingDatabase, userEntreprise);
        case 'admin':
          return _admin(currentEmailingDatabase);

        default:
          return _home(currentEmailingDatabase, userEntreprise);
      }
    }
  } else {
    let items = [
      {
        _tag: 'CSidebarNavItem',
        name: 'Dashboard',
        to: '/',
        icon: 'cil-speedometer'
      },
      {
        _tag: 'CSidebarNavItem',
        name: 'Search contact',
        to: `/searchContact`,
        fontIcon: 'fas fa-search'
      },
      {
        _tag: 'CSidebarNavItem',
        name: 'Content Stats',
        to: `/contentStats`,
        fontIcon: 'fas fa-chart-line'
      }
    ];

    if ((enterprise && enterprise.settings && enterprise.settings.campaigns) || (userEntreprise && userEntreprise.role === 'superAdmin')) {
      items = [
        ...items,
        {
          _tag: 'CSidebarNavItem',
          name: 'Campaigns',
          to: `/campaigns`,
          fontIcon: 'fas fa-envelope-open-text'
        },
        {
          _tag: 'CSidebarNavItem',
          name: 'Incomes',
          to: `/incomes`,
          fontIcon: 'fas fa-dollar-sign'
        }
      ];
    }
    if (userEntreprise && (userEntreprise.role === 'admin' || userEntreprise.role === 'superAdmin')) {
      items = [
        ...items,
        {
          _tag: 'CSidebarNavTitle',
          _children: ['Admin']
        },
        {
          _tag: 'CSidebarNavItem',
          name: 'Users',
          to: `/users/`,
          fontIcon: 'fas fa-users'
        }
      ];
    }
    return items;
  }
};

const _contents = (currentEmailingDatabase) => {
  return [
    {
      _tag: 'CSidebarNavItem',
      name: 'Dashboard',
      to: `/${currentEmailingDatabase.uid}/contents/`,
      icon: 'cil-speedometer'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'All Contents',
      to: `/${currentEmailingDatabase.uid}/contents/list`,
      fontIcon: 'fas fa-envelope-open-text'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Stats',
      to: `/${currentEmailingDatabase.uid}/contents/stats`,
      fontIcon: 'fas fa-chart-line'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Incomes',
      to: `/${currentEmailingDatabase.uid}/contents/incomes`,
      fontIcon: 'fas fa-dollar-sign'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Templates',
      to: `/${currentEmailingDatabase.uid}/contents/templates`,
      fontIcon: 'fas fa-file'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Template Parts',
      to: `/${currentEmailingDatabase.uid}/contents/template_parts`,
      fontIcon: 'fas fa-file-code'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'BATs',
      to: `/${currentEmailingDatabase.uid}/contents/bats`,
      fontIcon: 'fas fa-calendar-check'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Partners',
      to: `/${currentEmailingDatabase.uid}/contents/partners`,
      fontIcon: 'far fa-handshake'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Suggestions',
      to: `/${currentEmailingDatabase.uid}/contents/suggestions`,
      fontIcon: 'far fa-lightbulb'
    }
  ];
};

const _sendings = (currentEmailingDatabase, userEntreprise) => {
  let items = [
    {
      _tag: 'CSidebarNavItem',
      name: 'Dashboard',
      to: `/${currentEmailingDatabase.uid}/sendings/`,
      icon: 'cil-speedometer'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Deliv',
      to: `/${currentEmailingDatabase.uid}/sendings/deliv`,
      fontIcon: 'fas fa-chart-line'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Schedules',
      to: `/${currentEmailingDatabase.uid}/sendings/schedules`,
      fontIcon: 'far fa-calendar-alt'
    }
  ];
  if (userEntreprise && userEntreprise.role === 'superAdmin') {
    items.push({
      _tag: 'CSidebarNavItem',
      name: 'Settings',
      to: `/${currentEmailingDatabase.uid}/sendings/settings`,
      fontIcon: 'fas fa-cogs'
    });
  }
  return items;
};

const _contacts = (currentEmailingDatabase) => {
  return [
    {
      _tag: 'CSidebarNavItem',
      name: 'Dashboard',
      to: `/${currentEmailingDatabase.uid}/contacts/`,
      icon: 'cil-speedometer'
    },
    {
      _tag: 'CSidebarNavTitle',
      _children: ['Contacts']
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Stats',
      to: `/${currentEmailingDatabase.uid}/contacts/stats`,
      fontIcon: 'fas fa-table'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'All contacts',
      to: `/${currentEmailingDatabase.uid}/contacts/list`,
      fontIcon: 'fas fa-users'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Contact events',
      to: `/${currentEmailingDatabase.uid}/contacts/events/list`,
      fontIcon: 'fas fa-history'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Exclusion Lists',
      to: `/${currentEmailingDatabase.uid}/contacts/exclusionLists/`,
      fontIcon: 'fas fa-ban'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Inclusion Lists',
      to: `/${currentEmailingDatabase.uid}/contacts/inclusionLists/`,
      fontIcon: 'fas fa-arrow-alt-circle-right'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Blacklist',
      to: `/${currentEmailingDatabase.uid}/contacts/blacklist/`,
      fontIcon: 'fas fa-user-slash'
    },
    {
      _tag: 'CSidebarNavTitle',
      _children: ['Inscriptions']
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'By Sources',
      to: `/${currentEmailingDatabase.uid}/contacts/inscriptions/sources`,
      fontIcon: 'fas fa-mars'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'By Esps',
      to: `/${currentEmailingDatabase.uid}/contacts/inscriptions/esps`,
      fontIcon: 'fas fa-at'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'All inscriptions',
      to: `/${currentEmailingDatabase.uid}/contacts/inscriptions/list`,
      fontIcon: 'fas fa-sign-in-alt'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Activation Stats',
      to: `/${currentEmailingDatabase.uid}/contacts/activation`,
      fontIcon: 'fas fa-table'
    },
    {
      _tag: 'CSidebarNavTitle',
      _children: ['Messages']
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'All messages',
      to: `/${currentEmailingDatabase.uid}/contacts/messages/list`,
      fontIcon: 'fas fa-envelope-open-text'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Message rules',
      to: `/${currentEmailingDatabase.uid}/contacts/messages/rules/list`,
      fontIcon: 'fas fa-filter'
    },
    {
      _tag: 'CSidebarNavTitle',
      _children: ['Settings']
    }
  ];
};
const _home = (currentEmailingDatabase, userEntreprise) => {
  let homeResult = [
    {
      _tag: 'CSidebarNavItem',
      name: 'Dashboard',
      to: `/${currentEmailingDatabase.uid}/`,
      icon: 'cil-speedometer'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Suggestions',
      to: `/${currentEmailingDatabase.uid}/suggestions`,
      fontIcon: 'far fa-lightbulb'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'History',
      to: `/${currentEmailingDatabase.uid}/history`,
      fontIcon: 'fas fa-history'
    }
  ];
  if (userEntreprise && (userEntreprise.role === 'admin' || userEntreprise.role === 'superAdmin'))
    homeResult.push({
      _tag: 'CSidebarNavItem',
      name: 'Api Keys',
      to: `/${currentEmailingDatabase.uid}/api_keys/`,
      fontIcon: 'fas fa-key'
    });
  return homeResult;
};

const _admin = (currentEmailingDatabase) => {
  return [
    {
      _tag: 'CSidebarNavItem',
      name: 'Delivrability',
      to: `/${currentEmailingDatabase.uid}/admin/delivrability`,
      fontIcon: 'fas fa-chart-line'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Activation',
      to: `/${currentEmailingDatabase.uid}/admin/activation`,
      fontIcon: 'fas fa-table'
    },
    {
      _tag: 'CSidebarNavItem',
      name: 'Settings Editor',
      to: `/${currentEmailingDatabase.uid}/admin/settings`,
      fontIcon: 'fas fa-cogs'
    }
  ];
};
