import jwt from 'jsonwebtoken'
import 'dotenv/config'

function authorize(req,res,next){
    try{
        const authHeader = req.headers.authorization ;
    
        if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json('invalid token');
        }
    
        const token = authHeader.split(' ')[1] ;
        const payload = jwt.verify(token,process.env.JWT_SECRET);

        req.userId = payload.sub ;
        next() ;

    }catch(error){
        res.status(401).json('invalid login')
    }
}



export default authorize ;