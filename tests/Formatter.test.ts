import * as chai from 'chai'
import * as mocha from 'mocha'
import { Formatter } from '../src/lib'

const expect = chai.expect
const describe = mocha.describe

describe('The formatter class should be exported and contain it\'s methods', () => {
  it('should contain the 4 methods', () => {
    expect(Formatter.prototype.formatMsg).to.be.a('function')
    expect(Formatter.prototype.colorMsg).to.be.a('function')
    expect(Formatter.prototype.getPrettyTime).to.be.a('function')
    expect(Formatter.prototype.getUTCTime).to.be.a('function')
  })
})
