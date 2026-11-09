export const getTypeBadge = (type) => {
  switch (type) {
    case 'delivered':
      return 'primary';
    case 'click':
    case 'open':
    case 'proxy_loaded':
      return 'success';

    case 'unsub':
    case 'soft_bounce':
      return 'warning';
    case 'complaint':
    case 'hard_bounce':
      return 'danger';

    default:
      return 'secondary';
  }
};
