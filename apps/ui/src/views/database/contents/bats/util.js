export const getBatStatusBadge = (status) => {
  switch (status) {
    case 'validated':
      return 'success';
    case 'waiting':
      return 'warning';
    case 'rejected':
      return 'danger';
    case 'draft':
    default:
      return 'secondary';
  }
};
