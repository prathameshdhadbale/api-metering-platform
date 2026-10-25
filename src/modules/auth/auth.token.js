import jwt from 'jsonwebtoken'
import 'dotenv/config'

function createJwtToken(id){
        const token = jwt.sign({sub: id},process.env.JWT_SECRET,{
            expiresIn : '15m'
        }) ;

        return token;
};


export default createJwtToken ;