var db = require('../config/connection')
var collection = require('../config/collections')
const bcrypt = require('bcrypt')
var objectId = require('mongodb').ObjectID
module.exports = {
    doNewRegister: (userData) => {
        return new Promise(async(resolve, reject) => {
            userData.Password = await bcrypt.hash(userData.Password, 10)
            db.get().collection(collection.USER_COLLECTION).insertOne(userData).then((data) => {
                //console.log(data)
                resolve(data.ops[0])
            })

        })


    },
    doNewLogin: (userData) => {
        return new Promise(async(resolve, reject) => {
            let loginStatus = false
            let response = {}
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ Username: userData.Username })
            if (user) {
                bcrypt.compare(userData.Password, user.Password).then((status) => {
                    if (status) {
                        console.log("Login success")
                        response.user = user
                        response.loginStatus = true
                        resolve(response)
                    } else {
                        console.log("Login failed")
                        resolve({ loginStatus: false })
                    }
                })

            } else {
                console.log("Login failed no user found")
                resolve({ loginStatus: false })
            }

        })
    }

}