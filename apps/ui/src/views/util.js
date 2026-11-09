const roundFloat = (value) => {
  if (!isNaN(value)) {
    value = Math.round(value * 100) / 100;
  } else {
    value = 0;
  }
  return value;
};

const formatFloat = (value) => {
  if (!isNaN(value)) {
    value = Math.round(value * 100) / 100;
    value = value.toString();
  } else {
    value = '';
  }
  return value;
};
const formatPercent = (value) => {
  return formatFloat(value) + ' %';
};

const formatInteger = (value) => {
  value = parseInt(value);
  if (!isNaN(value)) {
    value = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  } else {
    value = '';
  }
  return value;
};
const calculateAndFormatPercent = (a, b) => {
  return b ? formatPercent(calculatePercent(a, b)) : '';
};

const calculatePercent = (a, b) => {
  if (isNaN(a) || isNaN(b)) {
    return null;
  }
  if (!a || !b) {
    return 0;
  }
  return (100 * a) / b;
};

export { roundFloat, formatFloat, formatPercent, formatInteger, calculateAndFormatPercent, calculatePercent };
