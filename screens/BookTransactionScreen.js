import * as React from 'react';
import { StyleSheet, Text, View ,TouchableOpacity, TextInput ,Image, KeyboardAvoidingView, Alert, ToastAndroid} from 'react-native';
import * as Permissions from "expo-permissions";
import {BarCodeScanner} from 'expo-barcode-scanner';
import firebase from "firebase";
import db from "../config";

export default class BookTransaction extends React.Component {

  constructor (){
    super();
    this.state = {
      hasCameraPermissions : null,
      scanned  : false,
      scannedBookId : '',
      scannedStudentId : '',
      buttonState : "normal",
      transactionMessage : ''
    }
  }

  getCameraPermissions=async(id)=>{
    const {status} = await Permissions.askAsync(Permissions.CAMERA);
    this.setState({
      hasCameraPermissions : status === "granted",
      buttonState : id,
      scanned : false
    })
  }

  handleBarCodeScanned = async({type,data})=>{
    const {buttonState}= this.state
    if(buttonState === "BookId"){
      this.setState ({
        scanned : true,
        scannedBookId : data,
        buttonState : "normal"
      })
    }else if(buttonState ==="StudentId"){
      this.setState ({
        scanned : true,
        scannedStudentId : data,
        buttonState : "normal"
      })
    }
  }

  initiateBookIssue = async ()=>{
    //add a transaction
    db.collection("transactions").add({
      'studentId' : this.state.scannedStudentId,
      'bookId' : this.state.scannedBookId,
      'date' : firebase.firestore.Timestamp.now().toDate(),
      'transactionType' : "Issue"
    })

    //change book status
    db.collection("books").doc(this.state.scannedBookId).update({
      'bookAvailability' : false
    })
    //change number of issued books for student
    db.collection("student").doc(this.state.scannedStudentId).update({
      'numberOfBookIssued' : firebase.firestore.FieldValue.increment(1)
    })

    this.setState({
      scannedStudentId : '',
      scannedBookId: ''
    })
  }

  initiateBookReturn = async ()=>{
    //add a transaction
    db.collection("transactions").add({
      'studentId' : this.state.scannedStudentId,
      'bookId' : this.state.scannedBookId,
      'date'   : firebase.firestore.Timestamp.now().toDate(),
      'transactionType' : "Return"
    })

    //change book status
    db.collection("books").doc(this.state.scannedBookId).update({
      'bookAvailability' : true
    })

    //change book status
    db.collection("student").doc(this.state.scannedStudentId).update({
      'numberOfBookIssued' : firebase.firestore.FieldValue.increment(-1)
    })

    this.setState({
      scannedStudentId : '',
      scannedBookId : ''
    })
  }

  checkStudentEligibilityForBookIssue = async ()  => {
    const studentRef =  await db.collection("student")
    .where("studentId","==",this.state.scannedStudentId).get();
    var isStudentEligible = '';
    if(studentRef.docs.length === 0 ){
      this.setState({
        scannedStudentId: "",
        scannedBookId: ""
      });
      isStudentEligible = false;
      Alert.alert("The student id doesn't exist in the database!");
    }else{
      studentRef.docs.map((doc)=>{
        var student = doc.data();
        if(student.numberOfBookIssued < 2 ){
          isStudentEligible = true;
        }else{
          isStudentEligible = false;
          Alert.alert("The student had already issued more than 2 books");
          this.setState({
            scannedStudentId: "",
            scannedBookId: ""
          });
        }
      })
    }
    return isStudentEligible;
  }

  checkStudentEligibilityForBookReturn = async ()  => {
    const transactionRef =  await db.collection("transactions")
    .where("bookId","==",this.state.scannedBookId)
    .limit(1).get();
    var isStudentEligible = '';
    
    transactionRef.docs.map((doc)=>{
      var lastBookTransaction = doc.data();
      if(lastBookTransaction.studentId.trim() === this.state.scannedStudentId.trim() ){
        isStudentEligible = true;
      }else{
        isStudentEligible = false;
        Alert.alert("The book wasn't issued by this student");
        this.setState({
          scannedStudentId: "",
          scannedBookId: ""
        });
      }
    })
    
    return isStudentEligible;
  }

  checkBookEligibility = async ()  => {
    const bookRef =  await db.collection("books")
    .where("bookId","==",this.state.scannedBookId).get();
    var transactionType = '';
    if(bookRef.docs.length === 0 ){      
      transactionType = false;
    }else{
      bookRef.docs.map((doc)=>{
        var book = doc.data();
        if(book.bookAvailability){
          transactionType = "Issue";
        }else{
          transactionType = "Return";
        }
      })
    }
    return transactionType;
  }  

  handleTransaction = async()=>{    
    var transactionType =  await this.checkBookEligibility();
    console.log(transactionType);
    if(!transactionType){
      Alert.alert("The book doesn't exist in the library database");
      this.setState({
        scannedStudentId: "",
        scannedBookId: ""
      })
    }else if(transactionType === "Issue"){
      var isStudentEligible = await this.checkStudentEligibilityForBookIssue();
      if(isStudentEligible){
        this.initiateBookIssue();
        Alert.alert("Book Issued");
      }
    }else {
      var isStudentEligible = await this.checkStudentEligibilityForBookReturn();
      if(isStudentEligible){
        this.initiateBookReturn();
        Alert.alert("Book Returned");
      }
    }  
    
  }

  componentDidMount(){
    console.log("**************************");
  }
  render(){
    const hasCameraPermissions = this.state.hasCameraPermissions;
    const scanned = this.state.scanned;
    const buttonState = this.state.buttonState;

    {if(buttonState !== "normal" && hasCameraPermissions ){
      return(
        <BarCodeScanner onBarCodeScanned = {scanned?undefined : this.handleBarCodeScanned}/>
      )
    }else if(buttonState === "normal"){
      return (
        <KeyboardAvoidingView style = {styles.container} behavior = "padding" enabled>
          <View>
            <Image 
            source = {require("../assets/booklogo.jpg")} style = {{width : 200, height : 200}}/>
            <Text style = {{textAlign : "center",fontSize : 30}}>Willy App</Text>
          </View>

          <View style = {styles.inputView}>
            <TextInput style = {styles.inputBox}
            placeholder = "BookId"
            value ={this.state.scannedBookId}
            onChangeText = {(text)=>{
              this.setState({
                scannedBookId : text,
              })
            }}
            
            />
            <TouchableOpacity style = {styles.scanButton} 
            onPress = {()=>{
              this.getCameraPermissions("BookId")
            }}>
              <Text>Scan</Text>
          </TouchableOpacity>
          </View>
            
          <View style = {styles.inputView}>
          <TextInput style = {styles.inputBox}
            placeholder = "StudentId"
            value = {this.state.scannedStudentId}
            onChangeText = {(text)=>{
              this.setState({
                scannedStudentId : text
              })
            }}
            />
            <TouchableOpacity style = {styles.scanButton} 
            onPress = {()=>{
              this.getCameraPermissions("StudentId")
            }}>
              <Text>Scan</Text>
          </TouchableOpacity>
          </View>
          <Text style={styles.transactionAlert}>{this.state.transactionMessage}</Text>
          <TouchableOpacity style = {styles.submitButton}
          onPress = {async ()=>{
            console.log("inside onPress");
             await this.handleTransaction()
            }}>
            <Text style = {styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
          
        </KeyboardAvoidingView>
      );
    }
  }
  }
  
}

const styles = StyleSheet.create({
  container :{
    flex : 1,
    justifyContent : "center",
    alignItems : "center",
    
  },
  displayText :{
    fontSize : 50,
    textDecorationLine : "underline",
     
  },
  scanButton :{
    backgroundColor : "#A456B4",
    width : 50,
    borderWidth : 1.5,
    borderLeftWidth : 0
  },
   buttonText:{
     fontSize : 20
   },
   inputView :{
     flexDirection : "row",
     margin : 20,
   },
   inputBox :{
     width : 200,
     height : 40,
     borderWidth : 1.5,
     fontSize : 20,

   },
   submitButton :{
     backgroundColor : "#fbc02d",
     width : 100,
     height : 50,
    
   },
   submitButtonText:{
     padding : 10,
     textAlign : "center",
     fontSize : 20,
     fontWeight : "bold",
     color : "white"
   },
   transactionAlert:{
    fontSize : 20,
    color:'red'
   }
})

