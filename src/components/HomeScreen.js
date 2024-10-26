import { GOOGLE_CLOUD_FUNCTION_URL } from "@env";
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  Button, 
  TextInput, 
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  Alert
} from "react-native";
import { Picker } from '@react-native-picker/picker';
import { Audio } from 'expo-av';
import { auth } from "../firebase/firebaseConfig";

const STORAGE_KEY = '@saved_phrases';

const VOICES = [
  { label: 'Grace (MT)', value: 'mt-MT-GraceNeural' },
  { label: 'Joseph (MT)', value: 'mt-MT-JosephNeural' },
  { label: 'Ada (EN)', value: 'en-GB-AdaMultilingualNeural' },
  { label: 'Ollie (EN)', value: 'en-GB-OllieMultilingualNeural' }
];

const SPEEDS = [
  { label: 'Extra Slow', value: 'x-slow' },
  { label: 'Slow', value: 'slow' },
  { label: 'Medium', value: 'medium' },
  { label: 'Fast', value: 'fast' },
  { label: 'Extra Fast', value: 'x-fast' }
];

export default function HomeScreen({ navigation }) {
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState('mt-MT-GraceNeural');
  const [selectedSpeed, setSelectedSpeed] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sound, setSound] = useState();
  const [savedPhrases, setSavedPhrases] = useState([]);

  useEffect(() => {
    loadSavedPhrases();
  }, []);

  const loadSavedPhrases = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonValue != null) {
        setSavedPhrases(JSON.parse(jsonValue));
      }
    } catch (error) {
      console.error('Error loading phrases:', error);
      setError('Failed to load saved phrases');
    }
  };

  const savePhrase = async (newPhrase) => {
    try {
      const updatedPhrases = [...savedPhrases, newPhrase];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPhrases));
      setSavedPhrases(updatedPhrases);
    } catch (error) {
      console.error('Error saving phrase:', error);
      throw error;
    }
  };

  const deletePhrase = async (id) => {
    try {
      const updatedPhrases = savedPhrases.filter(phrase => phrase.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPhrases));
      setSavedPhrases(updatedPhrases);
    } catch (error) {
      console.error('Error deleting phrase:', error);
      throw error;
    }
  };

  const handleSignOut = () => {
    auth.signOut()
      .then(() => {
        navigation.replace('Login');
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const playSound = async (audioBase64) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${audioBase64}` }
      );
      setSound(newSound);
      await newSound.playAsync();
    } catch (error) {
      console.error('Error playing sound:', error);
      setError('Failed to play audio');
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!text.trim()) {
      setError('Please enter some text');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(GOOGLE_CLOUD_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          speed: selectedSpeed,
          voice: selectedVoice
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64data = reader.result.split(',')[1];
        try {
          const newPhrase = {
            id: Date.now().toString(),
            text: text.trim(),
            audioData: base64data,
            voice: selectedVoice,
            speed: selectedSpeed,
            timestamp: new Date().toISOString()
          };
          await savePhrase(newPhrase);
          playSound(base64data);
          setText('');
        } catch (error) {
          setError('Failed to save phrase');
        }
      };

    } catch (error) {
      console.error('Error fetching audio:', error);
      setError('Failed to get audio. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhrasePress = (phrase) => {
    playSound(phrase.audioData);
  };

  const handleLongPress = (phrase) => {
    Alert.alert(
      "Delete Phrase",
      "Are you sure you want to delete this saved phrase?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePhrase(phrase.id);
            } catch (error) {
              setError('Failed to delete phrase');
            }
          }
        }
      ]
    );
  };

  React.useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  React.useEffect(() => {
    const getPermissions = async () => {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
      } catch (error) {
        console.error('Error requesting audio permissions:', error);
        setError('Failed to get audio permissions');
      }
    };

    getPermissions();
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.pickerContainer}>
            <Text style={styles.labelText}>Voice:</Text>
            <Picker
              selectedValue={selectedVoice}
              onValueChange={(itemValue) => setSelectedVoice(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {VOICES.map((voice) => (
                <Picker.Item 
                  key={voice.value} 
                  label={voice.label} 
                  value={voice.value} 
                />
              ))}
            </Picker>
          </View>

          <View style={styles.pickerContainer}>
            <Text style={styles.labelText}>Speed:</Text>
            <Picker
              selectedValue={selectedSpeed}
              onValueChange={(itemValue) => setSelectedSpeed(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {SPEEDS.map((speed) => (
                <Picker.Item 
                  key={speed.value} 
                  label={speed.label} 
                  value={speed.value} 
                />
              ))}
            </Picker>
          </View>
          
          <TextInput
            style={styles.input}
            multiline
            numberOfLines={4}
            onChangeText={setText}
            value={text}
            placeholder="Enter text to convert to speech..."
            placeholderTextColor="#666"
          />
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          
          <View style={styles.buttonContainer}>
            <Button 
              title={loading ? "Converting..." : "Convert to Speech"} 
              onPress={handleSubmit}
              disabled={loading || !text.trim()}
            />
          </View>

          {loading && <ActivityIndicator size="large" color="#0000ff" />}

          <View style={styles.savedPhrasesContainer}>
            <Text style={styles.sectionTitle}>Saved Phrases</Text>
            {savedPhrases.length === 0 ? (
              <Text style={styles.noPhrasesText}>No saved phrases yet</Text>
            ) : (
              savedPhrases
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .map((phrase) => (
                  <TouchableOpacity
                    key={phrase.id}
                    style={styles.phraseButton}
                    onPress={() => handlePhrasePress(phrase)}
                    onLongPress={() => handleLongPress(phrase)}
                  >
                    <Text style={styles.phraseButtonText}>{phrase.text}</Text>
                    <Text style={styles.phraseDetails}>
                      Voice: {VOICES.find(v => v.value === phrase.voice)?.label || phrase.voice}
                      {'\n'}
                      Speed: {phrase.speed}
                    </Text>
                  </TouchableOpacity>
                ))
            )}
          </View>
          
          <Button title="Sign Out" onPress={handleSignOut} />
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  pickerContainer: {
    width: '90%',
    marginBottom: 10,
  },
  labelText: {
    fontSize: 16,
    marginBottom: 5,
  },
  picker: {
    width: '100%',
    height: 50,
    backgroundColor: '#f0f0f0',
    marginBottom: 10,
    ...Platform.select({
      ios: {
        backgroundColor: 'transparent',
      },
    }),
  },
  pickerItem: {
    height: 44,
    color: 'black',
  },
  input: {
    height: 100,
    width: '90%',
    margin: 12,
    borderWidth: 1,
    padding: 10,
    textAlignVertical: 'top',
    borderRadius: 5,
  },
  buttonContainer: {
    marginVertical: 20,
    width: '90%',
  },
  errorText: {
    color: 'red',
    marginTop: 10,
  },
  savedPhrasesContainer: {
    width: '90%',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  noPhrasesText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 10,
  },
  phraseButton: {
    backgroundColor: '#e0e0e0',
    padding: 15,
    borderRadius: 5,
    marginVertical: 5,
  },
  phraseButtonText: {
    fontSize: 16,
    marginBottom: 5,
  },
  phraseDetails: {
    fontSize: 12,
    color: '#666',
  },
});