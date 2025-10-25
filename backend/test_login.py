#!/usr/bin/env python3
"""
Test script for login functionality with the created test users.
This script tests the login API endpoints to ensure the test users can log in successfully.
"""

import requests
import json
import time
import sys
import os

def test_login_functionality():
    """Test login functionality for the created test users"""

    base_url = 'http://localhost:5000'

    print('🧪 Testing login API endpoint with the created test users...')

    # Test login for each user
    test_users = [
        {'email': 'dharun@example.com', 'password': 'dharun123', 'name': 'Dharun'},
        {'email': 'vasanth@example.com', 'password': 'vasanth123', 'name': 'Vasanth'},
        {'email': 'kavin@example.com', 'password': 'kavin123', 'name': 'Kavin'}
    ]

    login_results = []

    for user in test_users:
        print(f'\n🔐 Testing login for {user["name"]} ({user["email"]})...')

        login_data = {
            'email': user['email'],
            'password': user['password']
        }

        try:
            response = requests.post(f'{base_url}/auth/login', json=login_data, timeout=10)
            print(f'   Login response: {response.status_code}')

            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print(f'   ✅ Login successful for {user["name"]}')
                    print(f'   📧 Email: {data["user"]["email"]}')
                    print(f'   👤 Name: {data["user"]["name"]}')
                    print(f'   🔑 Token generated: {len(data.get("token", "")) > 0}')
                    login_results.append({'user': user['name'], 'success': True, 'token': data.get('token')})
                else:
                    print(f'   ❌ Login failed: {data.get("error", "Unknown error")}')
                    login_results.append({'user': user['name'], 'success': False, 'error': data.get('error')})
            else:
                print(f'   ❌ HTTP error: {response.status_code} - {response.text}')
                login_results.append({'user': user['name'], 'success': False, 'http_error': response.status_code})

        except requests.exceptions.RequestException as e:
            print(f'   ❌ Request error: {e}')
            login_results.append({'user': user['name'], 'success': False, 'request_error': str(e)})

    # Test invalid login attempts
    print('\n🚫 Testing invalid login scenarios...')

    # Wrong password
    print('\n1. Testing wrong password...')
    invalid_login = {'email': 'dharun@example.com', 'password': 'wrongpassword'}
    try:
        response = requests.post(f'{base_url}/auth/login', json=invalid_login, timeout=5)
        print(f'   Wrong password response: {response.status_code}')
        if response.status_code == 401:
            print('   ✅ Correctly rejected wrong password')
        else:
            print(f'   ⚠️  Unexpected response: {response.text}')
    except Exception as e:
        print(f'   ❌ Error testing wrong password: {e}')

    # Non-existent user
    print('\n2. Testing non-existent user...')
    nonexistent_login = {'email': 'nonexistent@example.com', 'password': 'password123'}
    try:
        response = requests.post(f'{base_url}/auth/login', json=nonexistent_login, timeout=5)
        print(f'   Non-existent user response: {response.status_code}')
        if response.status_code == 401:
            print('   ✅ Correctly rejected non-existent user')
        else:
            print(f'   ⚠️  Unexpected response: {response.text}')
    except Exception as e:
        print(f'   ❌ Error testing non-existent user: {e}')

    # Test profile endpoint with valid token
    if login_results and any(r['success'] for r in login_results):
        print('\n👤 Testing profile endpoint with valid token...')
        successful_login = next(r for r in login_results if r['success'])
        token = successful_login['token']
        headers = {'Authorization': token}

        try:
            response = requests.get(f'{base_url}/auth/profile', headers=headers, timeout=5)
            print(f'   Profile response: {response.status_code}')
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print('   ✅ Profile retrieval successful')
                    print(f'   👤 User: {data["user"]["name"]} ({data["user"]["email"]})')
                else:
                    print(f'   ❌ Profile retrieval failed: {data.get("error")}')
            else:
                print(f'   ❌ HTTP error: {response.status_code} - {response.text}')
        except Exception as e:
            print(f'   ❌ Error testing profile endpoint: {e}')

    # Summary
    print('\n📊 Login Testing Summary:')
    successful_logins = sum(1 for r in login_results if r['success'])
    total_tests = len(login_results)
    print(f'   ✅ Successful logins: {successful_logins}/{total_tests}')
    if successful_logins == total_tests:
        print('   🎉 All test users can now log in successfully!')
        return True
    else:
        print('   ⚠️  Some logins failed - check the details above')
        return False

if __name__ == '__main__':
    print('🚀 Starting login functionality tests...')
    print('📝 Make sure the Flask server is running on http://localhost:5000')
    print('   Run: cd backend && python -m flask run --host=0.0.0.0 --port=5000')
    print()

    success = test_login_functionality()

    if success:
        print('\n✅ All login tests passed!')
        sys.exit(0)
    else:
        print('\n❌ Some login tests failed!')
        sys.exit(1)

