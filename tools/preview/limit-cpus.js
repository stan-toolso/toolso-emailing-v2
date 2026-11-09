// Préchargé (--require) pendant le build CRA : terser lance os.cpus().length - 1 workers, trop pour un
// environnement plafonné à 1 Gio. On ne montre que 2 CPU à Node. Aucun effet sur le code de l'application.
const os = require('os');
const cpus = os.cpus.bind(os);
os.cpus = () => cpus().slice(0, 2);
if (typeof os.availableParallelism === 'function') {
  os.availableParallelism = () => 2;
}
