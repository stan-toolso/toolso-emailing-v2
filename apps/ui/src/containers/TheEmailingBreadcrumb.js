import { CBreadcrumb, CBreadcrumbItem, CLink, CSubheader } from '@coreui/react';
import React from 'react';
import { useLocation } from 'react-router-dom';

const TheSiteBreadcrumb = () => {
  const location = useLocation();

  let items = getItemsFromLocation(location);
  if (items.length <= 0) {
    return null;
  }
  return (
    <CSubheader className="px-3 justify-content-between">
      <CBreadcrumb className="border-0 c-subheader-nav m-0 px-0 px-md-3">
        {items.map((item, index) => {
          return (
            <CBreadcrumbItem active={item.active} key={index}>
              {item.to && !item.active && <CLink to={item.to}>{item.label}</CLink>}
              {(!item.to || item.active) && <span>{item.label}</span>}
            </CBreadcrumbItem>
          );
        })}
      </CBreadcrumb>
    </CSubheader>
  );
};

const getItemsFromLocation = (location) => {
  let paths = location.pathname.split('/').slice(1);
  if (paths.length > 0 && paths[paths.length - 1] === '') {
    paths = paths.slice(0, paths.length - 1);
  }
  let items = [];

  if (paths.length <= 1) {
    return items;
  }
  let emailingUid = paths[0];
  let firstPath = paths[1];
  let secondPath = paths.length > 2 ? paths[2] : null;
  let thirdPath = paths.length > 3 ? paths[3] : null;
  let fourthPath = paths.length > 4 ? paths[4] : null;
  let fifthPath = paths.length > 5 ? paths[5] : null;

  if (firstPath === '' || firstPath === 'notifications') {
    items.push({ label: 'Home', to: '/', active: firstPath === '' });
  }
  if (firstPath === 'notifications') {
    items.push({ label: 'Notifications', active: true });
  }

  if (firstPath === 'contacts' && secondPath) {
    items.push({ label: 'Contacts', to: `/${emailingUid}/contacts`, active: !secondPath });

    if (secondPath === 'list') {
      items.push({ label: 'List', to: `/${emailingUid}/contacts/list`, active: !thirdPath });
      if (thirdPath) {
        items.push({ label: thirdPath, active: true });
      }
    } else if (secondPath === 'stats') {
      items.push({ label: 'Stats', to: `/${emailingUid}/contacts/stats`, active: true });
    } else if (secondPath === 'events') {
      items.push({ label: 'Events', active: !thirdPath });
      if (thirdPath === 'list') {
        items.push({ label: 'List', to: `/${emailingUid}/contacts/events/list`, active: !fourthPath });
        if (fourthPath) {
          items.push({ label: fourthPath, active: true });
        }
      }
    } else if (secondPath === 'inscriptions') {
      items.push({ label: 'Inscriptions', active: !thirdPath });
      if (thirdPath === 'list') {
        items.push({ label: 'List', to: `/${emailingUid}/contacts/inscriptions/list`, active: !fourthPath });
        if (fourthPath) {
          items.push({ label: fourthPath, active: true });
        }
      } else if (thirdPath === 'sources') {
        items.push({ label: 'Sources', to: `/${emailingUid}/contacts/inscriptions/sources`, active: !fourthPath });
        if (fourthPath) {
          items.push({ label: fourthPath, active: true });
        }
      } else if (thirdPath === 'esps') {
        items.push({ label: 'ESPs', to: `/${emailingUid}/contacts/inscriptions/esps`, active: !fourthPath });
        if (fourthPath) {
          items.push({ label: fourthPath, active: true });
        }
      }
    } else if (secondPath === 'messages') {
      items.push({ label: 'Messages', active: !thirdPath });
      if (thirdPath === 'list') {
        items.push({ label: 'List', to: `/${emailingUid}/contacts/messages/list`, active: !fourthPath });
        if (fourthPath) {
          items.push({ label: fourthPath, active: true });
        }
      } else if (thirdPath === 'rules') {
        items.push({ label: 'Rules', active: !fourthPath });
        if (fourthPath === 'list') {
          items.push({ label: 'List', to: `/${emailingUid}/contacts/messages/rules/list`, active: !fifthPath });
          if (fifthPath) {
            items.push({ label: fifthPath, active: true });
          }
        }
      }
    } else if (secondPath === 'activation') {
      items.push({ label: 'Activation', to: `/${emailingUid}/contacts/activation`, active: !thirdPath });
      if (thirdPath === 'configs') {
        items.push({ label: 'Configs', active: true });
      }
    } else if (secondPath === 'settings') {
      items.push({ label: 'Settings', active: !thirdPath });
    } else if (secondPath === 'exclusionLists') {
      items.push({ label: 'Exclusion Lists', to: `/${emailingUid}/contacts/exclusionLists/`, active: !thirdPath });
      if (thirdPath) {
        items.push({ label: thirdPath, active: true });
      }
    } else if (secondPath === 'inclusionLists') {
      items.push({ label: 'Inclusion Lists', to: `/${emailingUid}/contacts/inclusionLists/`, active: !thirdPath });
      if (thirdPath) {
        items.push({ label: thirdPath, active: true });
      }
    } else if (secondPath === 'blacklist') {
      items.push({ label: 'Blacklist', to: `/${emailingUid}/contacts/blacklist/`, active: !thirdPath });
      if (thirdPath) {
        items.push({ label: thirdPath, active: true });
      }
    }
  }

  if (firstPath === 'contents' && secondPath && secondPath !== 'marketing' && secondPath !== 'newsletter' && secondPath !== 'welcome_mail') {
    items.push({ label: 'Contents', to: `/${emailingUid}/contents`, active: !secondPath });

    if (secondPath === 'list') {
      items.push({ label: 'List', to: `/${emailingUid}/contents/list`, active: !thirdPath });
      if (thirdPath) {
        items.push({ label: thirdPath, active: true });
      }
    } else if (secondPath === 'stats') {
      items.push({ label: 'Stats', to: `/${emailingUid}/contents/stats`, active: !thirdPath });
      if (thirdPath) {
        items.push({ label: thirdPath, active: true });
      }
    } else if (secondPath === 'incomes') {
      items.push({ label: 'Incomes', to: `/${emailingUid}/contents/incomes`, active: !thirdPath });
      if (thirdPath) {
        items.push({ label: thirdPath, active: true });
      }
    } else if (secondPath === 'templates') {
      items.push({ label: 'Templates', to: `/${emailingUid}/contents/templates`, active: !thirdPath });
      if (thirdPath) {
        items.push({ label: thirdPath, active: true });
      }
    } else if (secondPath === 'template_parts') {
      items.push({ label: 'Template Parts', to: `/${emailingUid}/contents/template_parts`, active: !thirdPath });
      if (thirdPath) {
        items.push({ label: thirdPath, active: true });
      }
    } else if (secondPath === 'partners') {
      items.push({ label: 'Partners', to: `/${emailingUid}/contents/partners`, active: !thirdPath });
      if (thirdPath) {
        items.push({ label: thirdPath, active: true });
      }
    }
  }
  if (firstPath === 'sendings' && secondPath) {
    items.push({ label: 'Sendings', to: `/${emailingUid}/sendings`, active: !secondPath });

    if (secondPath === 'settings') {
      items.push({ label: 'Settings', to: `/${emailingUid}/sendings/settings`, active: true });
    } else if (secondPath === 'deliv') {
      items.push({ label: 'Deliv', to: `/${emailingUid}/sendings/deliv`, active: true });
    } else if (secondPath === 'schedules') {
      items.push({ label: 'Schedules', to: `/${emailingUid}/sendings/schedules`, active: !thirdPath });
      if (thirdPath) {
        if (thirdPath === 'inscription') {
          items.push({ label: 'Inscription', to: `/${emailingUid}/sendings/schedules/inscription/`, active: !fourthPath });
        } else if (thirdPath === 'single_send') {
          items.push({ label: 'Single Send', to: `/${emailingUid}/sendings/schedules/single_send/`, active: !fourthPath });
        } else if (thirdPath === 'recurrent') {
          items.push({ label: 'Recurrent', to: `/${emailingUid}/sendings/schedules/recurrent/`, active: !fourthPath });
        }
        if (fourthPath) {
          items.push({ label: fourthPath, active: true });
        }
      }
    }
  }

  return items;
};

export default TheSiteBreadcrumb;
