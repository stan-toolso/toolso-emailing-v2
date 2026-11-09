var username = 'integration_testeur@toolso.io';
var password = 'frites';

describe('empty spec', () => {
  it('passes', () => {
    cy.visit('https://emailing-test.toolso.io/');
    cy.get('input[placeholder=Username]').type(username);
    cy.get('input[placeholder=Password]').type(password);
    cy.get('button').filter(':visible').click();
    cy.url().should('include', '/#/');
    cy.get('.c-sidebar-minimizer', { timeout: 5000 }).click();
  });
});
