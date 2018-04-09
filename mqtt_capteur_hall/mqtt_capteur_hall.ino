/*
 Basic B-L475E-IOT01A MQTT example

 This example is based on the mqtt_esp8266 provided with PubSubClient library.

 This sketch demonstrates the capabilities of the pubsub library in combination
 with the B-L475E-IOT01A board.

 It connects to an MQTT server then:
  - publishes "hello world" to the topic "outTopic" every two seconds
  - subscribes to the topic "inTopic", printing out any messages
    it receives. NB - it assumes the received payloads are strings not binary
  - If the first character of the topic "inTopic" is an 1, switch ON the LED_BUILTIN Led,
    else switch it off

 It will reconnect to the server if the connection is lost using a blocking
 reconnect function. See the 'mqtt_reconnect_nonblocking' example for how to
 achieve the same result without blocking the main loop.
*/
#include <SPI.h>
#include <WiFiST.h>
#include <PubSubClient.h>

// Update these with values suitable for your network.
char ssid[] = "wifiDM";//"fabMSTIC";
const char* password = "super_tapteo";//"plusdechocolatx2";
const char* mqtt_server = "192.168.0.50";// A mofifier
const char* mainTopic = "project04/";

SPIClass SPI_3(PC12, PC11, PC10);
WiFiClass WiFi(&SPI_3, PE0, PE1, PE8, PB13);
WiFiClient STClient;
int status = WL_IDLE_STATUS;     // the Wifi radio's status

// CAPTEUR HALL
#define PIN_INTERSEPT   (PD14)

 unsigned const int periode = 10;
 unsigned const int nbPeriodeStop = 1;

 const float vitesse_modere = 260.0;

 const float poids = 70.0;

 const float rayon = 30;

 volatile byte nbTour;
 volatile int nbTourSeance;
 float tempsEnHeure;
 float rpm;
 float vitesseMoy;
 unsigned int caloriesBrulees;
 unsigned long timeold;
 unsigned long debut;
//unsigned const int periode = 10;
//unsigned const int nbPeriodeStop = 1;
//
long lastSend = 0;
//volatile byte nbTour;
//volatile int nbTourSeance;
//unsigned int rpm;
//unsigned long timeold;
//unsigned long debut;

bool seanceEnCours;

PubSubClient client(STClient);
long lastMsg = 0;
char msg[50];
long value = 0;

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);     // Initialize the LED_BUILTIN pin as an output
  Serial.begin(9600);

  Serial.println("Le capteur hall est lancé !");
  attachInterrupt(PIN_INTERSEPT, magnet_detect, RISING);//Initialize the intterrupt pin (Arduino digital pin 2)
  nbTour = 0;
  nbTourSeance = 0.0;
  rpm = 0;
  vitesseMoy = 0;
  caloriesBrulees = 0;
  timeold = 0;
  
  seanceEnCours = false;
   
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void setup_wifi() {

  delay(10);

  // initialize the WiFi module:
  if (WiFi.status() == WL_NO_SHIELD) {
    Serial.println("WiFi module not detected");
    // don't continue:
    while (true);
  }

  // print firmware version:
  String fv = WiFi.firmwareVersion();
  Serial.print("Firmware version: ");
  Serial.println(fv);

  if (fv != "C3.5.2.3.BETA9") {
    Serial.println("Please upgrade the firmware");
  }

  // attempt to connect to Wifi network:
  Serial.print("Attempting to connect to network: ");
  Serial.println(ssid);
  while (status != WL_CONNECTED) {
    Serial.print(".");
    // Connect to WPA2 network:
    status = WiFi.begin(ssid, password);
    if (status != WL_CONNECTED) {
      // Connect to WPA (TKIP) network:
      status = WiFi.begin(ssid, password, ES_WIFI_SEC_WPA);
    }
    // wait 10 seconds for connection:
    delay(10000);
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (unsigned int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();

  // Switch on the LED if an 1 was received as first character
  if ((char)payload[0] == '1') {
    digitalWrite(LED_BUILTIN, HIGH);   // Turn the LED on
  } else {
    digitalWrite(LED_BUILTIN, LOW);  // Turn the LED off
  }
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("B-L475E-IOT01AClient")) {
      Serial.println("connected");
      // Once connected, publish an announcement...
      client.publish("outTopic", "hello world");
      // ... and resubscribe
      client.subscribe("inTopic");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void magnet_detect()//This function is called whenever a magnet/interrupt is detected by the arduino
{
  if (client.connected()) {
     if(!seanceEnCours){
      Serial.println("Début de séance");
      debut = millis();
      seanceEnCours = true;
     }
     timeold = millis();
     nbTour++;
     nbTourSeance++;
     //Serial.println("detect");
     //Serial.println(nbTour,DEC);
  }
}

void capteurHall(){
  long tempsEntreDeuxPeriode = millis() - lastSend;
  lastSend = millis();
  if(tempsEntreDeuxPeriode > (periode * 1000)){ // toutes les periode secondes
    if(nbTour > 0){
      rpm = nbTour * 60 / periode; // vitesse en tour par minute

      //Serial.print(rpm,DEC);
      //Serial.println(" t/min");
      float kmh = (rpm * 2 * PI * rayon/100000)*60;
      int kmhInt = kmh;
      char vitesse [10];
      snprintf (vitesse, 10, "%d", kmhInt);
      Serial.print(vitesse);
      Serial.println(" t/min");
      char topic[100];
      strcpy(topic, mainTopic);
      strcat(topic, "hall/vitesse_inst");
      Serial.println(topic);
      client.publish(topic, vitesse);
      nbTour = 0;
    }
    if (seanceEnCours && (millis() - timeold) > (nbPeriodeStop * periode * 1000)){ // FIN DE SEANCE
      float time_seconde = (millis() - debut) / 1000;
      int nbSeconde = time_seconde;
      float heureFloat = time_seconde / 3600.0;
      int heure = heureFloat;
      float minsFloat = time_seconde / 60.0;
      int mins = minsFloat;
      int secs = time_seconde - mins * 60;
      Serial.print("Fin de la séance : ");
      Serial.print(mins,DEC);
      Serial.print(" minutes ");
      Serial.print(secs,DEC);
      Serial.println(" secondes");
      seanceEnCours = false;

      float nbTourSeanceFloat = nbTourSeance;
      vitesseMoy = nbTourSeanceFloat / minsFloat;

      caloriesBrulees = heureFloat * 70.0 * (poids/10) * (sqrt(vitesseMoy) / sqrt(vitesse_modere));

      // Envoyer les résultats
      char nbSecondeString[10];
      snprintf(nbSecondeString, 10, "%d", nbSeconde);
      Serial.print("nombre de secondes de la séance : ");
      Serial.println(nbSecondeString);
      
      nbTourSeance = 0;
      char caloriesBruleesString[10];
      snprintf(caloriesBruleesString, 10, "%d", caloriesBrulees);
      Serial.print("nombre de calories brulées : ");
      Serial.println(caloriesBruleesString);

      char topic1[100];
      strcpy(topic1, mainTopic);
      strcat(topic1, "hall/duree_seance");
      char topic2[100];
      strcpy(topic2, mainTopic);
      strcat(topic2, "hall/calories_brulees");

      char topic[100];
      strcpy(topic, mainTopic);
      strcat(topic, "hall/vitesse_inst");
      Serial.println(topic);
      client.publish(topic, "0");
      
      client.publish(topic1, nbSecondeString);
      client.publish(topic2,caloriesBruleesString);

      nbTourSeance = 0;
    }
  }
}

void loop() {

  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  capteurHall();
  
//  long now = millis();
//  if (now - lastMsg > 2000) {
//    lastMsg = now;
//    ++value;
//    snprintf (msg, 50, "hello world #%ld", value);
//    Serial.print("Publish message: ");
//    Serial.println(msg);
//    char topic[100];
//    strcpy(topic, mainTopic);
//    strcat(topic, "project04/outTopic");
//    client.publish(topic, msg);
//  }
}