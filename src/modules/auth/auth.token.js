import jwt from 'jsonwebtoken'
import { config } from '../../config/env.js';

function createJwtToken(id){
        const token = jwt.sign({ sub: id }, config.jwtSecret, {
            algorithm: 'HS256',
            expiresIn: '15m',
            issuer: 'api-metering-platform',
            audience: 'api-metering-platform-api'
        });

        return token;
};


export default createJwtToken ;
