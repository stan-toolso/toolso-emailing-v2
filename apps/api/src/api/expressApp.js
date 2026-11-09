const log = require('../util/log').getLogger('ExpressApp');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

var sourceFilter = require('./filters/sourceFilter');
var tokenFilter = require('./filters/tokenFilter');
var batFilter = require('./filters/batFilter');

const { graphqlUploadExpress } = require('graphql-upload');
const requestIp = require('request-ip');

module.exports = {
  initExpress: () => {
    log.debug('Init Express server');

    const app = express();
    app.use(bodyParser.json({ limit: '50mb', extended: true }));

    app.use(
      express.urlencoded({
        extended: true
      })
    );

    app.set('view engine', 'pug');

    app.use(graphqlUploadExpress({ maxFileSize: 1000000000, maxFiles: 10 }));

    app.use(requestIp.mw());

    app.use(cors());
    app.use(require('./middlewares/ApiKeyMiddleware'));
    app.use(require('./middlewares/TokenMiddleware'));

    //Duplicate contact route (legacy and V2 route)
    //TODO : Remove obsolete routes

    //Obso
    app.post('/contact/inscription', tokenFilter, require('./expressResolvers/contacts/Post'));
    app.post('/contact/unsubscribe', tokenFilter, require('./expressResolvers/contacts/UnsubscriptionPost'));
    app.put('/contact/:email', tokenFilter, require('./expressResolvers/contacts/contactPut'));
    app.post('/contact/message/', tokenFilter, require('./expressResolvers/contactMessagePost'));

    app.post('/source/contact/inscription', sourceFilter, require('./expressResolvers/source/contactInscriptionPost'));
    app.get('/source/contact/live_request', sourceFilter, require('./expressResolvers/source/liveRequestGet'));

    app.get('/content/templates', tokenFilter, require('./expressResolvers/contentTemplates'));
    app.get('/content/:content_id/version/:version_id/preview', tokenFilter, require('./expressResolvers/contentPreview'));
    app.post('/content', tokenFilter, require('./expressResolvers/contentPost'));
    app.put('/content/:content_id', tokenFilter, require('./expressResolvers/contentPut'));
    app.get('/content/:content_id', tokenFilter, require('./expressResolvers/contentGet'));

    //page publique de gestion du consentement au pixel de tracking (lien {{pixelConsentLink}} dans les emails)
    app.get('/pixel_consent/:key/:token', require('./expressResolvers/pixelConsentPage'));
    app.post('/pixel_consent/:key/:token', require('./expressResolvers/pixelConsentPage'));

    app.get('/bat/:uid/:versionId/validate', batFilter, require('./expressResolvers/bat/validate'));
    app.post('/bat/:uid/:versionId/validate', batFilter, require('./expressResolvers/bat/validate'));

    //V2
    app.post('/v2/contacts/', tokenFilter, require('./expressResolvers/contacts/Post'));
    app.post('/v2/contact-unsubscriptions', tokenFilter, require('./expressResolvers/contacts/UnsubscriptionPost')); //TODO : a rediscuter avec stan /contacts/unsubcription ou /contact-unsubcription qui respecte plus les guidelines?
    app.post('/v2/contacts/unsubscriptions/', tokenFilter, require('./expressResolvers/contacts/UnsubscriptionPost'));
    app.delete('/v2/contacts/', tokenFilter, require('./expressResolvers/contacts/Delete'));
    app.put('/v2/contacts/', tokenFilter, require('./expressResolvers/contacts/contactPut'));
    app.post('/v2/contacts/pixel_tracking_consent', tokenFilter, require('./expressResolvers/contacts/PixelTrackingConsentPost'));

    app.post('/v2/sources/contacts/', sourceFilter, require('./expressResolvers/source/contactInscriptionPost'));

    app.get('/v2/contents/templates', tokenFilter, require('./expressResolvers/contentTemplates'));
    app.get('/v2/contents/:content_id/versions/:version_id/preview', tokenFilter, require('./expressResolvers/contentPreview'));
    app.post('/v2/contents', tokenFilter, require('./expressResolvers/contentPost'));
    app.put('/v2/contents/:content_id', tokenFilter, require('./expressResolvers/contentPut'));
    app.get('/v2/contents/:content_id', tokenFilter, require('./expressResolvers/contentGet'));

    app.post('/v2/bats/:uid/:versionId/validatation', batFilter, require('./expressResolvers/bat/validate'));

    return app;
  }
};
