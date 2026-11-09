export const getContactStatusBadge = (status) => {
  switch (status) {
    case 'workable':
      return 'success';
    case 'unsub':
      return 'warning';
    case 'complaint':
    case 'hard_bounce':
      return 'danger';
    default:
      return 'secondary';
  }
};
