export const getMessageStatusBadge = (status) => {
  switch (status) {
    case 'done':
      return 'success';
    case 'pending':
      return 'warning';
    default:
      return 'pending';
  }
};
