import React, { useReducer, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Initial State
const initialState = {
  timers: [],
  history: [],
};

// Reducer
function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_TIMERS':
      return { ...state, timers: action.payload };
    case 'LOAD_HISTORY':
      return { ...state, history: action.payload };
    case 'ADD_TIMER':
      const updatedTimers = [...state.timers, action.payload];
      AsyncStorage.setItem('timers', JSON.stringify(updatedTimers));
      return { ...state, timers: updatedTimers };
    case 'UPDATE_TIMER':
      const modifiedTimers = state.timers.map((timer) =>
        timer.id === action.payload.id ? action.payload : timer
      );
      AsyncStorage.setItem('timers', JSON.stringify(modifiedTimers));
      return { ...state, timers: modifiedTimers };
    case 'COMPLETE_TIMER':
      const completedTimer = state.timers.find(t => t.id === action.payload);
      const updatedHistory = [
        ...state.history,
        { name: completedTimer.name, completedAt: new Date().toLocaleString() },
      ];
      AsyncStorage.setItem('history', JSON.stringify(updatedHistory));
      return {
        ...state,
        history: updatedHistory,
        timers: state.timers.map(t =>
          t.id === action.payload
            ? { ...t, status: 'Completed', remaining: 0 }
            : t
        ),
      };
    default:
      return state;
  }
}

// Timer Component
function TimerItem({ timer, dispatch }) {
  const intervalRef = useRef(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (timer.status === 'Running' && timer.remaining > 0) {
      intervalRef.current = setInterval(() => {
        let newRemaining = timer.remaining - 1;
        let updatedTimer = { ...timer, remaining: newRemaining };

        // Halfway alert
        if (!timer.halfwayAlertShown && newRemaining <= timer.duration / 2) {
          Alert.alert('⏳ Halfway There!', `${timer.name} is halfway done.`);
          updatedTimer.halfwayAlertShown = true;
        }

        // Completion
        if (newRemaining <= 0) {
          updatedTimer.remaining = 0;
          updatedTimer.status = 'Completed';
          dispatch({ type: 'COMPLETE_TIMER', payload: timer.id });
          setModalVisible(true);
          clearInterval(intervalRef.current);
        } else {
          dispatch({ type: 'UPDATE_TIMER', payload: updatedTimer });
        }
      }, 1000);
    }

    return () => clearInterval(intervalRef.current);
  }, [timer]);

  return (
    <View style={styles.timerBox}>
      <Text style={styles.timerText}>{timer.name}</Text>
      <Text>
        {timer.remaining}s / {timer.duration}s
      </Text>

      {/* Custom Progress Bar */}
      <View style={styles.progressBackground}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${(timer.remaining / timer.duration) * 100}%`,
            },
          ]}
        />
      </View>

      <Text>Status: {timer.status}</Text>
      <View style={styles.row}>
        <Button
          title="Start"
          onPress={() =>
            dispatch({
              type: 'UPDATE_TIMER',
              payload: { ...timer, status: 'Running' },
            })
          }
        />
        <Button
          title="Pause"
          onPress={() =>
            dispatch({
              type: 'UPDATE_TIMER',
              payload: { ...timer, status: 'Paused' },
            })
          }
        />
        <Button
          title="Reset"
          onPress={() =>
            dispatch({
              type: 'UPDATE_TIMER',
              payload: {
                ...timer,
                remaining: timer.duration,
                status: 'Paused',
                halfwayAlertShown: false,
              },
            })
          }
        />
      </View>

      <Modal visible={modalVisible} transparent>
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text>🎉 {timer.name} Completed!</Text>
            <Button title="OK" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Home Screen
function HomeScreen({ navigation }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    (async () => {
      const storedTimers = await AsyncStorage.getItem('timers');
      const storedHistory = await AsyncStorage.getItem('history');
      if (storedTimers) {
        dispatch({ type: 'LOAD_TIMERS', payload: JSON.parse(storedTimers) });
      }
      if (storedHistory) {
        dispatch({ type: 'LOAD_HISTORY', payload: JSON.parse(storedHistory) });
      }
    })();
  }, []);

  const groupedTimers = state.timers.reduce((acc, timer) => {
    if (!acc[timer.category]) acc[timer.category] = [];
    acc[timer.category].push(timer);
    return acc;
  }, {});

  const addTimer = () => {
    if (!name || !duration || !category) {
      Alert.alert('All fields are required!');
      return;
    }

    const parsedDuration = parseInt(duration);
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      Alert.alert('Enter a valid duration in seconds!');
      return;
    }

    const newTimer = {
      id: Date.now().toString(),
      name,
      duration: parsedDuration,
      remaining: parsedDuration,
      category,
      status: 'Paused',
      halfwayAlertShown: false,
    };

    dispatch({ type: 'ADD_TIMER', payload: newTimer });
    setName('');
    setDuration('');
    setCategory('');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
        <Text style={styles.heading}>Add Timer</Text>
        <TextInput
          placeholder="Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          placeholder="Duration (sec)"
          value={duration}
          onChangeText={setDuration}
          keyboardType="numeric"
          style={styles.input}
        />
        <TextInput
          placeholder="Category"
          value={category}
          onChangeText={setCategory}
          style={styles.input}
        />
        <Button title="Add Timer" onPress={addTimer} />

        <Text style={styles.heading}>Timers</Text>
        {Object.keys(groupedTimers).map((cat) => (
          <View key={cat} style={styles.categoryBox}>
            <Text style={styles.categoryText}>{cat}</Text>
            {groupedTimers[cat].map((timer) => (
              <TimerItem key={timer.id} timer={timer} dispatch={dispatch} />
            ))}
          </View>
        ))}

        <Button
          title="Go to History"
          onPress={() => navigation.navigate('History', { history: state.history })}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// History Screen
function HistoryScreen({ route }) {
  const { history } = route.params;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Timer History</Text>
      {history.length === 0 ? (
        <Text>No completed timers yet.</Text>
      ) : (
        history.map((h, index) => (
          <View key={index} style={styles.historyBox}>
            <Text>{h.name}</Text>
            <Text>Completed At: {h.completedAt}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// Navigation
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { padding: 16 },
  heading: { fontSize: 22, fontWeight: 'bold', marginVertical: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginVertical: 5,
    borderRadius: 6,
  },
  timerBox: {
    padding: 10,
    backgroundColor: '#f9f9f9',
    marginVertical: 5,
    borderRadius: 8,
  },
  timerText: { fontSize: 18, fontWeight: 'bold' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 5,
  },
  modal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000088',
  },
  modalContent: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  categoryBox: {
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#eaeaea',
    borderRadius: 8,
  },
  categoryText: { fontSize: 18, fontWeight: 'bold' },
  historyBox: {
    padding: 10,
    marginVertical: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  progressBackground: {
    height: 10,
    width: '100%',
    backgroundColor: '#ddd',
    borderRadius: 5,
    marginVertical: 5,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#4caf50',
    borderRadius: 5,
  },
});
