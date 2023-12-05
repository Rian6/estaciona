import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, FlatList, TextInput, Keyboard } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import MapViewDirections from 'react-native-maps-directions';
import { FAB, List, Snackbar } from 'react-native-paper';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, get, set } from 'firebase/database';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CarIcon from './carro-novo.png';
import EstacionamentoIcon from './estacionamento.png';
import EstacionamentoIconSelecionado from './estacionamento-selecionado.png';

const firebaseConfig = {
  apiKey: "AIzaSyBLyW23PzMoK710i2I0-iDOID96x28ka0g",
  authDomain: "app-estacionamento-405800.firebaseapp.com",
  projectId: "app-estacionamento-405800",
  storageBucket: "app-estacionamento-405800.appspot.com",
  messagingSenderId: "922600555506",
  appId: "1:922600555506:web:27321870cb8d67b772616b",
  measurementId: "G-TNZ8WPX0HV"
};

const App = () => {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationSave, setLocationSave] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [chaveApi, setChaveApi] = useState('AIzaSyBLyW23PzMoK710i2I0-iDOID96x28ka0g');
  const [watchId, setWatchId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [savedLocations, setSavedLocations] = useState([]);
  const [locationName, setLocationName] = useState('');
  const [destino, setDestino] = useState({});
  const [directions, setDirections] = useState([]);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(false);

  const mapRef = useRef(null); 
  
  const onDismissSnackBar = () => setVisible(false);

  useEffect(() => {
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getDatabase(firebaseApp);

    getLocation();
    loadSavedLocations(db);

    const id = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
      },
      (location) => {
        setCurrentLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    );

    setWatchId(id);

    return () => {
      if (watchId) {
        Location.clearWatchAsync(watchId);
      }
    };
  }, []);

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Permissão de localização não concedida');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch (error) {
      console.error('Erro ao obter localização atual:', error);
    }
  };

  const handleLocationSelect = (data, details) => {
    fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${details.place_id}&key=${chaveApi}`
    )
      .then((response) => response.json())
      .then((data) => {
        const location = data.result.geometry.location;

        if (location) {
          setLocationSave({
            lat: location.lat,
            lng: location.lng,
            name: details.name,
          });

        } else {
          console.error('Localização não encontrada nos detalhes:', data.result);
        }
      })
      .catch((error) => {
        console.error('Erro ao obter detalhes do local:', error);
      });
  };

  const loadSavedLocations = (db) => {
    const marcadoresRef = ref(db, 'marcadores');

    onValue(marcadoresRef, (snapshot) => {
      const marcadores = snapshot.val();
      const listaMarcadores = [];

      for (let id in marcadores) {
        listaMarcadores.push({
          id,
          ...marcadores[id],
        });
      }

      setSavedLocations(listaMarcadores);
    });
  };

  const handleSaveLocation = () => {
    if (locationSave && locationName) {
      const databaseRef = ref(getDatabase(), 'marcadores');
      const newLocationRef = push(databaseRef);

      set(newLocationRef, {
        name: locationName,
        latitude: locationSave.lat,
        longitude: locationSave.lng,
      });

      setModalVisible(false);
    } else {
      console.error('Selecione um local e forneça um nome antes de salvar.');
    }
  };

  const onToggleSnackBar = (text) => {
    setVisible(!visible)
    setMessage(text)
  };

  const handleRoute = (item) => {
    setSearch("")
    onToggleSnackBar("Rota definida para: "+item.name) 
    Keyboard.dismiss() 
    setDestino(item);
    

    const updatedRegion = {
      latitude: item ? item.latitude : currentLocation.lat,
      longitude: item ? item.longitude : currentLocation.lng,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };

    setSelectedLocation(item ? null : updatedRegion);
          
    if (currentLocation && item) {
      setDirections([
        {
          origin: {
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
          },
          destination: {
            latitude: item.latitude,
            longitude: item.longitude,
          },
          apikey: chaveApi,
          strokeWidth: 3,
          strokeColor: 'black',
        },
      ]);
    }

    mapRef.current?.animateToRegion(updatedRegion, 1000);
  }

  const handleLocationSearch = async (text) => {
    setDirections([]);
    const marcadoresRef = ref(getDatabase(), 'marcadores');
    const snapshot = await get(marcadoresRef);

    const listaMarcadores = [];
    snapshot.forEach((childSnapshot) => {
      listaMarcadores.push({
        id: childSnapshot.key,
        ...childSnapshot.val(),
      });
    });

    const filteredMarkers = listaMarcadores.filter((marker) =>
      marker.name.toLowerCase().includes(text.toLowerCase())
    );

    setSavedLocations(filteredMarkers);
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <MapView
          ref={(map) => (mapRef.current = map)}
          style={styles.map}
          region={{
            latitude: selectedLocation ? selectedLocation.lat : currentLocation?.lat || DEFAULT_LATITUDE,
            longitude: selectedLocation ? selectedLocation.lng : currentLocation?.lng || DEFAULT_LONGITUDE,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {directions.map((direction, index) => (
            <MapViewDirections
              key={index}
              origin={direction.origin}
              destination={direction.destination}
              apikey={direction.apikey}
              strokeWidth={direction.strokeWidth}
              strokeColor={direction.strokeColor}
            />
          ))}

          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.lat,
                longitude: currentLocation.lng,
              }}
              title="Seu Carro"
              description="Sua localização atual"
              image={CarIcon}
              style={{ width: 40, height: 40 }}
            />
          )}

          {savedLocations.map((location, index) => (
            <Marker
              key={index}
              coordinate={{ latitude: location.latitude, longitude: location.longitude }}
              title={location.name}
              image={
                location === destino
                  ? EstacionamentoIconSelecionado
                  : EstacionamentoIcon
              }
            />
          ))}
        </MapView>
        <View style={styles.inputPesquisa}
        >
          <TextInput
            placeholder="Pesquisar Estacionamento"
            mode="outlined"
            style={styles.input}
            value={search}
            onChangeText={(text) => {
              setSearch(text),
                handleLocationSearch(text)
            }}
          />
          {
            savedLocations && search && (
              <View style={styles.viewPesquisa}>
                {savedLocations.map((item, i) => (
                  <List.Item
                    key={i}
                    onPress={() => handleRoute(item)}
                    title={item.name}
                    description={item.description}
                    left={(props) => <List.Icon {...props} icon="marker" />}
                  />
                ))}
              </View>
            )
          }
        </View>
        <FAB
          icon="plus"
          color='white'
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        />
        <Snackbar
          visible={visible}
          onDismiss={onDismissSnackBar}
          rippleColor={'white'}
          style={{backgroundColor: 'black'}} 
          action={{
            label: 'Undo',
            onPress: () => {
              // Do something
            },
          }}>
          {message}
        </Snackbar>
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cadastrar Estacionamento</Text>

              <TextInput
                placeholder="Nome do local"
                mode='outlined'
                style={styles.input}
                value={locationName}
                onChangeText={(text) => setLocationName(text)}
              />
              <GooglePlacesAutocomplete
                placeholder="Pesquisar"
                onPress={handleLocationSelect}
                styles={{
                  textInput: {
                    height: 60,
                    padding: 10,
                    borderWidth: 0.6,
                    borderRadius: 6,
                    borderColor: 'black',
                    marginBottom: 10,
                  },
                  predefinedPlacesDescription: {
                    color: '#1faadb',
                  },
                }}
                query={{
                  key: chaveApi,
                  language: 'pt-BR',
                }}
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveLocation}
              >
                <Text style={styles.saveButtonText}>Salvar Estacionamento</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaProvider>
  );
};

const DEFAULT_LATITUDE = 37.78825;
const DEFAULT_LONGITUDE = -122.4324;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#f6f6f6',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: '60%',
    height: 'auto',
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  labbelPesquisa: {
    maxHeight: 250,
    marginBottom: 10,
  },
  input: {
    height: 60,
    padding: 10,
    borderWidth: 1,
    borderRadius: 6,
    backgroundColor: 'white',
    borderColor: 'black',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'black',
    fontWeight: 'bold',
  },
  viewPesquisa: {
    backgroundColor: 'white'
  },
  inputPesquisa: {
    position: 'absolute',
    top: 40,
    left: 10,
    right: 10,
  },
  fab: {
    backgroundColor: 'black',
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default App;
