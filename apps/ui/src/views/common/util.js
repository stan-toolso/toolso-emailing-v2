const roundFloat = (value) => {
  if (!isNaN(value)) {
    value = Math.round(value * 100) / 100;
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
  return formatPercent(calculatePercent(a, b));
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

const customParseFloat = (a) => {
  if (a === undefined || a === null) {
    return null;
  }
  return a.replace(/,/g, '.').replace(/ /g, '');
};

const formatIncome = (value, maximumFractionDigits = 2, minimumFractionDigits = 2) => {
 
  if(value === null){
    return '';
  }
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits, maximumFractionDigits }).format(value);

};

const colors = [
  { backgroundColor: '#1b9e3e', color: '#FFF' },
  { backgroundColor: '#1b9e3e', color: '#FFF' },
  { backgroundColor: '#2eb85c', color: '#FFF' },
  { backgroundColor: '#2eb85c', color: '#FFF' },
  { backgroundColor: '#96dbad', color: '#000' },
  { backgroundColor: '#96dbad', color: '#000' },
  { backgroundColor: '#cbedd6', color: '#000' },
  { backgroundColor: '#cbedd6', color: '#000' },
  { backgroundColor: '#feecc5', color: '#000' },
  { backgroundColor: '#fcd88a', color: '#000' },
  { backgroundColor: '#f9b115', color: '#000' },
  { backgroundColor: '#f6960b', color: '#000' },
  { backgroundColor: '#f2a9a9', color: '#000' },
  { backgroundColor: '#e55353', color: '#000' },
  { backgroundColor: '#d93737', color: '#FFF' }
];

const getValueColors = (refValue, value, inverse) => {
  if (refValue) {
    let rate = Math.max(Math.min(1, value / (2 * refValue)), 0);
    let colorIndex = Math.round((1 - rate) * (colors.length - 1));
    return inverse ? colors[colors.length - 1 - colorIndex] : colors[colorIndex];
  }
  return { backgroundColor: '#FFF', color: '#000' };
};

export { roundFloat, formatFloat, formatPercent, formatInteger, formatIncome, calculateAndFormatPercent, calculatePercent, customParseFloat, getValueColors };
